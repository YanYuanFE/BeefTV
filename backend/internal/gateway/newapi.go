// Package gateway signs in to the configured new-api compatible gateway with
// account credentials and returns an API key for an OpenAI-compatible channel.
// It is stateless: the caller stores the key as an ordinary model channel.
package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"infinite-canvas/backend/internal/outbound"
)

const (
	KeyPrefix = "beeftv-auto"
	// BaseURLEnv selects the gateway (main site or a distributor site); the UI never sees it.
	BaseURLEnv     = "BEEFTV_GATEWAY_BASE_URL"
	defaultBaseURL = "https://subrouter.ai"
	// KeyGroupEnv selects the token group that carries subscribed models.
	KeyGroupEnv     = "BEEFTV_GATEWAY_KEY_GROUP"
	defaultKeyGroup = "subrouter"

	ReasonTwoFactorRequired = "two_factor_required"
	ReasonUpstream          = "bad_gateway"
)

type LoginInput struct {
	Username      string `json:"username"`
	Password      string `json:"password"`
	TwoFactorCode string `json:"twoFactorCode"`
}

type Account struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName,omitempty"`
	Email       string `json:"email,omitempty"`
}

type Session struct {
	BaseURL string  `json:"baseUrl"`
	APIKey  string  `json:"apiKey"`
	KeyName string  `json:"keyName"`
	Account Account `json:"account"`
}

// Error is a user-facing gateway failure; Reason is empty for invalid input.
type Error struct {
	Message string
	Reason  string
}

func (e *Error) Error() string { return e.Message }

// ConfiguredBaseURL returns the deployment's gateway origin.
func ConfiguredBaseURL() string {
	return firstNonEmpty(NormalizeBaseURL(os.Getenv(BaseURLEnv)), defaultBaseURL)
}

func configuredKeyGroup() string {
	return firstNonEmpty(strings.TrimSpace(os.Getenv(KeyGroupEnv)), defaultKeyGroup)
}

func Login(ctx context.Context, client *http.Client, baseURL string, input LoginInput) (Session, error) {
	username := strings.TrimSpace(input.Username)
	if username == "" || input.Password == "" {
		return Session{}, &Error{Message: "请填写账号和密码"}
	}
	baseURL = NormalizeBaseURL(baseURL)
	if _, err := outbound.ValidateCustomRelayURL(baseURL); err != nil {
		return Session{}, err
	}
	g := &caller{ctx: ctx, client: client, baseURL: baseURL}

	payload, cookie, err := g.call(http.MethodPost, "/api/user/login", nil, map[string]string{"username": username, "password": input.Password})
	if err != nil {
		return Session{}, err
	}
	if cookie == "" {
		return Session{}, &Error{Message: "登录成功但服务未返回会话", Reason: ReasonUpstream}
	}
	user := userMap(payload)
	if truthy(dataMap(payload)["require_2fa"]) {
		code := strings.TrimSpace(input.TwoFactorCode)
		if code == "" {
			return Session{}, &Error{Message: "该账号启用了双重验证，请输入验证码", Reason: ReasonTwoFactorRequired}
		}
		verified, extra, err := g.call(http.MethodPost, "/api/user/login/2fa", map[string]string{"Cookie": cookie}, map[string]string{"code": code})
		if err != nil {
			return Session{}, err
		}
		cookie = mergeCookies(cookie, extra)
		user = userMap(verified)
	}
	account := Account{
		ID:          stringValue(user["id"]),
		Username:    firstNonEmpty(stringValue(user["username"]), username),
		DisplayName: stringValue(user["display_name"]),
		Email:       stringValue(user["email"]),
	}
	if account.ID == "" {
		return Session{}, &Error{Message: "服务未返回用户信息", Reason: ReasonUpstream}
	}

	headers := map[string]string{"Cookie": cookie, "New-Api-User": account.ID}
	key, name, err := g.ensureKey(headers)
	if err != nil {
		return Session{}, err
	}
	return Session{BaseURL: baseURL, APIKey: key, KeyName: name, Account: account}, nil
}

// NormalizeBaseURL strips trailing slashes and a trailing /v1 so the value
// matches the channel convention (the OpenAI path is appended per request).
func NormalizeBaseURL(raw string) string {
	value := strings.TrimRight(strings.TrimSpace(raw), "/")
	value = strings.TrimSuffix(value, "/v1")
	return strings.TrimRight(value, "/")
}

// ensureKey reuses the first auto-created token, or creates one and reads it back.
func (g *caller) ensureKey(headers map[string]string) (string, string, error) {
	tokens, err := g.listTokens(headers)
	if err != nil {
		return "", "", err
	}
	for _, token := range tokens {
		name := stringValue(token["name"])
		if strings.HasPrefix(name, KeyPrefix) {
			if key := normalizeKey(stringValue(token["key"])); key != "" {
				return key, name, nil
			}
		}
	}
	name := fmt.Sprintf("%s-%d", KeyPrefix, time.Now().Unix())
	body := map[string]any{
		"name": name, "expired_time": -1, "remain_quota": 0, "unlimited_quota": true,
		"model_limits_enabled": false, "group": configuredKeyGroup(),
		"include_official_channels": true, "official_key_max_discount": 0,
	}
	if _, _, err := g.call(http.MethodPost, "/api/token/", headers, body); err != nil {
		return "", "", err
	}
	tokens, err = g.listTokens(headers)
	if err != nil {
		return "", "", err
	}
	for _, token := range tokens {
		if stringValue(token["name"]) == name {
			if key := normalizeKey(stringValue(token["key"])); key != "" {
				return key, name, nil
			}
		}
	}
	return "", "", &Error{Message: "访问密钥已创建但未能读取", Reason: ReasonUpstream}
}

func (g *caller) listTokens(headers map[string]string) ([]map[string]any, error) {
	payload, _, err := g.call(http.MethodGet, "/api/token/?p=0&size=100", headers, nil)
	if err != nil {
		return nil, err
	}
	var raw any = payload["data"]
	if data, ok := raw.(map[string]any); ok {
		raw = data["items"]
	}
	items, _ := raw.([]any)
	tokens := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if token, ok := item.(map[string]any); ok {
			tokens = append(tokens, token)
		}
	}
	return tokens, nil
}

type caller struct {
	ctx     context.Context
	client  *http.Client
	baseURL string
}

// call sends one JSON request and returns the decoded body plus any session cookies.
func (g *caller) call(method, path string, headers map[string]string, body any) (map[string]any, string, error) {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, "", err
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(g.ctx, method, g.baseURL+path, reader)
	if err != nil {
		return nil, "", err
	}
	request.Header.Set("Accept", "application/json")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	outbound.ApplyDefaultOutboundHeaders(request)
	response, err := g.client.Do(request)
	if err != nil {
		return nil, "", &Error{Message: "服务连接失败", Reason: ReasonUpstream}
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return nil, "", &Error{Message: "服务响应读取失败", Reason: ReasonUpstream}
	}
	payload := map[string]any{}
	decodeErr := json.Unmarshal(raw, &payload)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fallback := fmt.Sprintf("服务请求失败：%d", response.StatusCode)
		if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
			fallback = "服务鉴权失败"
		}
		return nil, "", &Error{Message: upstreamMessage(payload, fallback), Reason: ReasonUpstream}
	}
	if decodeErr != nil {
		return nil, "", &Error{Message: "服务响应格式异常", Reason: ReasonUpstream}
	}
	if success, ok := payload["success"].(bool); ok && !success {
		// new-api reports business failures (bad password, bad 2FA code) with HTTP 200.
		return nil, "", &Error{Message: upstreamMessage(payload, "登录失败")}
	}
	return payload, cookieHeader(response.Header.Values("Set-Cookie")), nil
}

func cookieHeader(values []string) string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		if pair := strings.TrimSpace(strings.SplitN(value, ";", 2)[0]); pair != "" {
			parts = append(parts, pair)
		}
	}
	return strings.Join(parts, "; ")
}

// mergeCookies overlays cookies from next onto base by name.
func mergeCookies(base, next string) string {
	order := []string{}
	values := map[string]string{}
	for _, header := range []string{base, next} {
		for _, pair := range strings.Split(header, ";") {
			pair = strings.TrimSpace(pair)
			name, _, found := strings.Cut(pair, "=")
			if !found || name == "" {
				continue
			}
			if _, seen := values[name]; !seen {
				order = append(order, name)
			}
			values[name] = pair
		}
	}
	parts := make([]string, 0, len(order))
	for _, name := range order {
		parts = append(parts, values[name])
	}
	return strings.Join(parts, "; ")
}

func upstreamMessage(payload map[string]any, fallback string) string {
	for _, key := range []string{"message", "msg"} {
		if value := strings.TrimSpace(stringValue(payload[key])); value != "" {
			return value
		}
	}
	if detail, ok := payload["error"].(map[string]any); ok {
		if value := strings.TrimSpace(stringValue(detail["message"])); value != "" {
			return value
		}
	}
	return fallback
}

func normalizeKey(key string) string {
	key = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(key), "Bearer "))
	// Masked keys (e.g. "sk-ab**cd") cannot authenticate; treat them as unreadable.
	if key == "" || strings.Contains(key, "*") {
		return ""
	}
	if strings.HasPrefix(key, "sk-") {
		return key
	}
	return "sk-" + key
}

func dataMap(payload map[string]any) map[string]any {
	if data, ok := payload["data"].(map[string]any); ok {
		return data
	}
	return map[string]any{}
}

func userMap(payload map[string]any) map[string]any {
	data := dataMap(payload)
	if nested, ok := data["user"].(map[string]any); ok {
		return nested
	}
	return data
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case float64:
		if typed == float64(int64(typed)) {
			return fmt.Sprint(int64(typed))
		}
		return fmt.Sprint(typed)
	case nil:
		return ""
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func truthy(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return typed == "true" || typed == "1"
	case float64:
		return typed != 0
	}
	return false
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
