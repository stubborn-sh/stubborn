/*
 * Copyright 2026-present the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import java.util.function.Supplier;

import org.springframework.cloud.contract.spec.Contract;

public class ContractPostBar implements Supplier<Contract> {

    @Override
    public Contract get() {
        return Contract.make(contract -> {
            contract.name("should_accept_post_bar_when_path_parameter_matches");
            contract.request(request -> {
                request.method("POST");
                request.urlPath("/bar/123");
            });
            contract.response(response -> response.status(201));
        });
    }
}
