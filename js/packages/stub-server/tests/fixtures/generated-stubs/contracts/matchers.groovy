org.springframework.cloud.contract.spec.Contract.make {
  description "body matchers inside arrays"
  request {
    method POST()
    url "/items/match"
    headers { contentType(applicationJson()) }
    body(items: [[id: "123", name: "First"]], count: 1)
    bodyMatchers {
      jsonPath('$.items[*].id', byRegex('[0-9]+'))
      jsonPath('$.items', byType { minOccurrence(1); maxOccurrence(5) })
      jsonPath('$.count', byEquality())
    }
  }
  response { status 200 }
}
