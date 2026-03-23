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
package sh.stubborn.broker.tag;

import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/applications/{name}/versions")
@ConditionalOnProperty(name = "broker.pro.enabled", havingValue = "true", matchIfMissing = true)
class TagController {

	private final TagService tagService;

	TagController(TagService tagService) {
		this.tagService = tagService;
	}

	@PutMapping("/{version}/tags/{tag}")
	ResponseEntity<TagResponse> addTag(@PathVariable String name, @PathVariable String version,
			@PathVariable String tag) {
		VersionTag versionTag = this.tagService.addTag(name, version, tag);
		return ResponseEntity.ok(TagResponse.from(versionTag));
	}

	@DeleteMapping("/{version}/tags/{tag}")
	ResponseEntity<Void> removeTag(@PathVariable String name, @PathVariable String version, @PathVariable String tag) {
		this.tagService.removeTag(name, version, tag);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/{version}/tags")
	ResponseEntity<List<TagResponse>> getTagsForVersion(@PathVariable String name, @PathVariable String version) {
		List<TagResponse> tags = this.tagService.findTagsByVersion(name, version)
			.stream()
			.map(TagResponse::from)
			.toList();
		return ResponseEntity.ok(tags);
	}

	@GetMapping("/latest")
	ResponseEntity<Map<String, String>> getLatestVersionByTag(@PathVariable String name, @RequestParam String tag) {
		String version = this.tagService.findLatestVersionByTag(name, tag);
		return ResponseEntity.ok(Map.of("version", version));
	}

}
