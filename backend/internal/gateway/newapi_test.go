package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"infinite-canvas/backend/internal/outbound"
)

// fakeNewAPI mimics the new-api login, 2FA and token endpoints the gateway exposes.
type fakeNewAPI struct {
	tokens  []map[string]any
	creates int
	groups  []string
}

func (f *fakeNewAPI) handler(t *testing.T) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/user/login", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["password"] != "secret-pw" {
			writeJSON(w, map[string]any{"success": false, "message": "用户名或密码错误"})
			return
		}
		http.SetCookie(w, &http.Cookie{Name: "session", Value: "s-" + body["username"]})
		if body["username"] == "tfa-user" {
			writeJSON(w, map[string]any{"success": true, "data": map[string]any{"require_2fa": true}})
			return
		}
		writeJSON(w, map[string]any{"success": true, "data": map[string]any{"id": 42, "username": body["username"], "display_name": "Alice"}})
	})
	mux.HandleFunc("/api/user/login/2fa", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if r.Header.Get("Cookie") != "session=s-tfa-user" || body["code"] != "123456" {
			writeJSON(w, map[string]any{"success": false, "message": "验证码错误"})
			return
		}
		http.SetCookie(w, &http.Cookie{Name: "session", Value: "s-tfa-verified"})
		writeJSON(w, map[string]any{"success": true, "data": map[string]any{"id": 7, "username": "tfa-user"}})
	})
	mux.HandleFunc("/api/token/", func(w http.ResponseWriter, r *http.Request) {
		cookie := r.Header.Get("Cookie")
		if !strings.HasPrefix(cookie, "session=s-") || r.Header.Get("New-Api-User") == "" {
			w.WriteHeader(http.StatusUnauthorized)
			writeJSON(w, map[string]any{"success": false, "message": "未登录"})
			return
		}
		if r.Method == http.MethodPost {
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			f.creates++
			f.groups = append(f.groups, body["group"].(string))
			f.tokens = append(f.tokens, map[string]any{"id": 900 + f.creates, "name": body["name"], "key": "created-key"})
			writeJSON(w, map[string]any{"success": true})
			return
		}
		writeJSON(w, map[string]any{"success": true, "data": map[string]any{"items": f.tokens}})
	})
	return mux
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}

func newFake(t *testing.T, fake *fakeNewAPI) string {
	t.Helper()
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	server := httptest.NewServer(fake.handler(t))
	t.Cleanup(server.Close)
	return server.URL
}

func login(t *testing.T, baseURL string, input LoginInput) (Session, error) {
	return Login(context.Background(), outbound.CustomRelayHTTPClient(5*time.Second), baseURL, input)
}

func TestLoginCreatesKeyThenReusesIt(t *testing.T) {
	fake := &fakeNewAPI{tokens: []map[string]any{{"id": 1, "name": "manual-key", "key": "manual"}}}
	baseURL := newFake(t, fake)

	first, err := login(t, baseURL+"/v1/", LoginInput{Username: "alice", Password: "secret-pw"})
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if first.BaseURL != baseURL || first.APIKey != "sk-created-key" || first.Account.ID != "42" || first.Account.DisplayName != "Alice" {
		t.Fatalf("unexpected session: %+v", first)
	}
	if !strings.HasPrefix(first.KeyName, KeyPrefix+"-") || fake.creates != 1 || fake.groups[0] != defaultKeyGroup {
		t.Fatalf("expected one subrouter-group auto key, got name=%q creates=%d groups=%v", first.KeyName, fake.creates, fake.groups)
	}

	second, err := login(t, baseURL, LoginInput{Username: "alice", Password: "secret-pw"})
	if err != nil {
		t.Fatalf("second login: %v", err)
	}
	if second.APIKey != "sk-created-key" || second.KeyName != first.KeyName || fake.creates != 1 {
		t.Fatalf("expected key reuse without a second create, got %+v creates=%d", second, fake.creates)
	}
}

func TestLoginRejectsWrongPasswordWithUpstreamMessage(t *testing.T) {
	baseURL := newFake(t, &fakeNewAPI{})
	_, err := login(t, baseURL, LoginInput{Username: "alice", Password: "wrong"})
	var gatewayErr *Error
	if !errors.As(err, &gatewayErr) || gatewayErr.Message != "用户名或密码错误" || gatewayErr.Reason != "" {
		t.Fatalf("expected upstream credential error, got %#v", err)
	}
}

func TestLoginTwoFactorFlow(t *testing.T) {
	fake := &fakeNewAPI{}
	baseURL := newFake(t, fake)

	_, err := login(t, baseURL, LoginInput{Username: "tfa-user", Password: "secret-pw"})
	var gatewayErr *Error
	if !errors.As(err, &gatewayErr) || gatewayErr.Reason != ReasonTwoFactorRequired {
		t.Fatalf("expected two_factor_required, got %#v", err)
	}

	_, err = login(t, baseURL, LoginInput{Username: "tfa-user", Password: "secret-pw", TwoFactorCode: "000000"})
	if !errors.As(err, &gatewayErr) || gatewayErr.Message != "验证码错误" {
		t.Fatalf("expected bad code error, got %#v", err)
	}

	session, err := login(t, baseURL, LoginInput{Username: "tfa-user", Password: "secret-pw", TwoFactorCode: " 123456 "})
	if err != nil {
		t.Fatalf("2fa login: %v", err)
	}
	if session.Account.ID != "7" || session.APIKey != "sk-created-key" {
		t.Fatalf("unexpected 2fa session: %+v", session)
	}
}

func TestLoginRejectsMaskedKeyAndPrivateHost(t *testing.T) {
	fake := &fakeNewAPI{tokens: []map[string]any{{"id": 3, "name": KeyPrefix + "-1", "key": "sk-ab**cd"}}}
	baseURL := newFake(t, fake)
	session, err := login(t, baseURL, LoginInput{Username: "alice", Password: "secret-pw"})
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if session.APIKey != "sk-created-key" || fake.creates != 1 {
		t.Fatalf("masked key must not be reused, got %+v creates=%d", session, fake.creates)
	}

	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "")
	if _, err := login(t, baseURL, LoginInput{Username: "alice", Password: "secret-pw"}); err == nil {
		t.Fatal("expected untrusted loopback http base URL to be rejected")
	}
}

func TestConfiguredBaseURLAndKeyGroupFromEnv(t *testing.T) {
	t.Setenv(BaseURLEnv, "")
	t.Setenv(KeyGroupEnv, "")
	if ConfiguredBaseURL() != defaultBaseURL || configuredKeyGroup() != defaultKeyGroup {
		t.Fatalf("defaults = %q %q", ConfiguredBaseURL(), configuredKeyGroup())
	}
	t.Setenv(BaseURLEnv, " https://dist.example.com/v1/ ")
	t.Setenv(KeyGroupEnv, "dist-group")
	if ConfiguredBaseURL() != "https://dist.example.com" || configuredKeyGroup() != "dist-group" {
		t.Fatalf("env override = %q %q", ConfiguredBaseURL(), configuredKeyGroup())
	}
}
