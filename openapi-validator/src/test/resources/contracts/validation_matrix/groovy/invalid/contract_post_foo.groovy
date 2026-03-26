import org.springframework.cloud.contract.spec.Contract

Contract.make {
    name 'should_reject_post_foo_when_method_missing_in_openapi'
    request {
        method 'POST'
        urlPath '/foo'
    }
    response {
        status 200
    }
}
