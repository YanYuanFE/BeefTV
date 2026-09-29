package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"infinite-canvas/backend/internal/app"
	"infinite-canvas/backend/internal/workspace"

	"github.com/gin-gonic/gin"
)

func TestWorkspaceModelConfigRejectsStaleRevisionWithoutLeakingSecrets(t *testing.T) {
	router, _ := newModelConfigTestRouter(t)
	first := putModelConfig(t, router, 0, "first-secret")
	if first.Code != http.StatusOK {
		t.Fatalf("first put status = %d body=%s", first.Code, first.Body.String())
	}
	if revision := modelConfigResponseData(t, first)["revision"]; revision != float64(1) {
		t.Fatalf("committed revision = %#v", revision)
	}

	stale := putModelConfig(t, router, 0, "must-not-leak")
	if stale.Code != http.StatusConflict {
		t.Fatalf("stale put status = %d body=%s", stale.Code, stale.Body.String())
	}
	if bytes.Contains(stale.Body.Bytes(), []byte("must-not-leak")) || bytes.Contains(stale.Body.Bytes(), []byte("first-secret")) {
		t.Fatalf("error response leaked a secret: %s", stale.Body.String())
	}
}

func newModelConfigTestRouter(t *testing.T) (*gin.Engine, *workspace.ProviderConfig) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	store, err := workspace.NewProviderConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	service := app.NewLocal(nil, dir)
	router := gin.New()
	router.Use(WorkspaceMiddleware(workspace.Context{ID: "local", DataDir: dir}))
	router.Use(RuntimeDependenciesMiddleware(RuntimeDependencies{ProviderConfig: store}))
	RegisterWorkspaceRoutes(router.Group("/api"), service)
	return router, store
}

func putModelConfig(t *testing.T, router *gin.Engine, expectedRevision int64, apiKey string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]any{
		"expectedRevision": expectedRevision,
		"config":           map[string]any{"channels": []any{map[string]any{"id": "beefapi", "apiKey": apiKey, "enabled": true}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/workspace/model-config", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	return recorder
}

func modelConfigResponseData(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var envelope struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	return envelope.Data
}
