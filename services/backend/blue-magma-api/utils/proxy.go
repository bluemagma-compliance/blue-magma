package utils

import (
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/valyala/fasthttp"
)

func AddInternalApiKey(req *fasthttp.Request) {
	serviceToken := middleware.GetServiceToken()
	if serviceToken != "" {
		req.Header.Set("Authorization", serviceToken)
	}
}
