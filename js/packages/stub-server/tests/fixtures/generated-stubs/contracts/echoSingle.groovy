org.springframework.cloud.contract.spec.Contract.make {
  description "single item, request fields echoed"
  request {
    method POST()
    url "/items/single"
    headers { contentType(applicationJson()); header("X-Trace", "abc") }
    body(items: [[id: "1", name: "First"]], owner: [name: "Ann"])
  }
  response {
    status OK()
    headers { contentType(applicationJson()); header("X-Path", fromRequest().path()) }
    body(ids: fromRequest().body('$.items[*].id'), first: fromRequest().body('$.items[0].name'),
         owner: fromRequest().body('$.owner.name'), url: fromRequest().url(),
         trace: fromRequest().header("X-Trace"))
  }
}
