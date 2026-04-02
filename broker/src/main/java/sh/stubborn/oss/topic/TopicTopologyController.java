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
package sh.stubborn.oss.topic;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/topics")
class TopicTopologyController {

	private final TopicTopologyService topicTopologyService;

	TopicTopologyController(TopicTopologyService topicTopologyService) {
		this.topicTopologyService = topicTopologyService;
	}

	@GetMapping
	ResponseEntity<TopicTopologyResponse> getTopology() {
		TopicTopologyResponse response = this.topicTopologyService.getTopology();
		return ResponseEntity.ok(response);
	}

	@GetMapping("/{topicName}")
	ResponseEntity<TopicNode> getTopicByName(@PathVariable String topicName) {
		TopicNode node = this.topicTopologyService.getTopicByName(topicName);
		return ResponseEntity.ok(node);
	}

	@GetMapping("/applications/{appName}")
	ResponseEntity<TopicTopologyResponse> getTopicsForApplication(@PathVariable String appName) {
		TopicTopologyResponse response = this.topicTopologyService.getTopicsForApplication(appName);
		return ResponseEntity.ok(response);
	}

}
