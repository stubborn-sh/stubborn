org.springframework.cloud.contract.spec.Contract.make {
  description "echoes item ids back"
  request {
    method POST()
    url "/items/ids"
    headers { contentType(applicationJson()) }
    body(items: [[id: "1", name: "First"], [id: "2", name: "Second"]])
  }
  response {
    status OK()
    headers { contentType(applicationJson()) }
    body(ids: fromRequest().body('$.items[*].id'))
  }
}
