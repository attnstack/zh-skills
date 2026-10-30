Node.js 服务，最近一次发版在 2 小时前，之后开始偶发接口 500：

TypeError: Cannot read properties of undefined (reading 'id')
    at OrderService.attachUser (/app/dist/services/order.js:88:23)
    at /app/dist/routes/orders.js:41:11
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
出现频率：~5%，均为游客身份请求；登录用户正常。
