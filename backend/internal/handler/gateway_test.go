package handler

import (
	"errors"
	"net/http"
	"testing"

	"infinite-canvas/backend/internal/app"
	"infinite-canvas/backend/internal/gateway"
)

func TestGatewayAppErrorMapping(t *testing.T) {
	cases := []struct {
		err    error
		status int
		reason string
	}{
		{&gateway.Error{Message: "请输入验证码", Reason: gateway.ReasonTwoFactorRequired}, http.StatusBadRequest, "two_factor_required"},
		{&gateway.Error{Message: "用户名或密码错误"}, http.StatusBadRequest, "invalid_argument"},
		{&gateway.Error{Message: "网关连接失败", Reason: gateway.ReasonUpstream}, http.StatusBadGateway, "bad_gateway"},
	}
	for _, tc := range cases {
		var appErr *app.AppError
		if !errors.As(gatewayAppError(tc.err), &appErr) {
			t.Fatalf("%v: expected AppError", tc.err)
		}
		if appErr.Status != tc.status || string(appErr.Reason) != tc.reason || appErr.Message != tc.err.Error() {
			t.Fatalf("%v: got status=%d reason=%q message=%q", tc.err, appErr.Status, appErr.Reason, appErr.Message)
		}
	}
}
