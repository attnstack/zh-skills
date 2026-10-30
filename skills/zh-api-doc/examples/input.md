openapi: 3.0.0
paths:
  /v1/orders:
    post:
      summary: 创建订单
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [sku_id, quantity]
              properties:
                sku_id: { type: string, description: 商品 SKU 编号 }
                quantity: { type: integer, minimum: 1, maximum: 999 }
                remark: { type: string, description: 买家备注 }
      responses:
        "200": { description: 订单创建成功 }
        "400": { description: 参数错误 }
        "401": { description: 未登录 }
