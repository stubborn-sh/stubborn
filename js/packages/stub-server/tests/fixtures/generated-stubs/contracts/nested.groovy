org.springframework.cloud.contract.spec.Contract.make {
  description "nested arrays at depth"
  request {
    method POST()
    url "/orders"
    headers { contentType(applicationJson()) }
    body(order: [id: 7, lines: [[sku: "A", qty: 1, gift: true, tags: ["x", "y"], parts: [[code: "p1"]]]]])
  }
  response { status 201 }
}
