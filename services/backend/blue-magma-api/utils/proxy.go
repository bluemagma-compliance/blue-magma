package utils

import "github.com/valyala/fasthttp"

func AddInternalApiKey(req *fasthttp.Request) {
	serviceToken := GetServiceToken()
	if serviceToken != "" {
		req.Header.Set("Authorization", serviceToken)
	}
}
