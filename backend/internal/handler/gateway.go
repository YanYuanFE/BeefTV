package handler

import (
	"errors"
	"net/http"
	"time"

	"infinite-canvas/backend/internal/app"
	"infinite-canvas/backend/internal/gateway"
	"infinite-canvas/backend/internal/outbound"

	"github.com/gin-gonic/gin"
)

// RegisterGatewayRoutes exposes account login against the configured gateway.
// The response carries the issued API key; the caller saves it as a channel.
func RegisterGatewayRoutes(r *gin.RouterGroup, svc *app.Service) {
	r.POST("/account/login", func(c *gin.Context) {
		if _, err := workspaceForLocalRequest(c, svc); err != nil {
			fail(c, http.StatusUnauthorized, err)
			return
		}
		if !enforceRateLimit(c, "gateway-login", 10, time.Minute) {
			return
		}
		var input gateway.LoginInput
		if err := c.ShouldBindJSON(&input); err != nil {
			fail(c, http.StatusBadRequest, errors.New("登录参数格式错误"))
			return
		}
		session, err := gateway.Login(c.Request.Context(), outbound.CustomRelayHTTPClient(30*time.Second), gateway.ConfiguredBaseURL(), input)
		if err != nil {
			failService(c, gatewayAppError(err))
			return
		}
		ok(c, session)
	})
}

func gatewayAppError(err error) error {
	var gatewayErr *gateway.Error
	if errors.As(err, &gatewayErr) {
		if gatewayErr.Reason == gateway.ReasonUpstream {
			appErr := app.NewAppError(http.StatusBadGateway, gatewayErr.Message)
			appErr.Retryable = true
			return appErr
		}
		appErr := app.BadAuthRequest(gatewayErr.Message)
		if gatewayErr.Reason != "" {
			appErr.Reason = app.ErrorReason(gatewayErr.Reason)
		}
		return appErr
	}
	var badRequest *outbound.BadRequestError
	if errors.As(err, &badRequest) {
		return app.BadAuthRequest(badRequest.Message)
	}
	return err
}
