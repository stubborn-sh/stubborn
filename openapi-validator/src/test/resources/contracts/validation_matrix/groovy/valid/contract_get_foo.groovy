import org.springframework.cloud.contract.spec.Contract

Contract.make {
    name 'should_accept_get_foo_when_defined_in_openapi'
    request {
        method 'GET'
        urlPath '/foo'
    }
    response {
        status 200
    }
}
