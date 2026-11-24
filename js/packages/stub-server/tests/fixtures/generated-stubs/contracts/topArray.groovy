org.springframework.cloud.contract.spec.Contract.make {
  description "top-level array body"
  request {
    method PUT()
    url "/items"
    headers { contentType(applicationJson()) }
    body([[id: "1", price: 2.5], [id: "2", price: 3]])
  }
  response { status 204 }
}
