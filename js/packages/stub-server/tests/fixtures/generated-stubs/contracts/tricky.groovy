org.springframework.cloud.contract.spec.Contract.make {
  description "tricky values"
  request {
    method POST()
    url "/items/tricky"
    headers { contentType(applicationJson()) }
    body(grid: [[1, 2], [3]], notes: [[text: "it's (a) [test] \$5 & \"q\"", gone: null]], 'odd key': [v: -1.5], empty: [], obj: [:])
  }
  response { status 200 }
}
