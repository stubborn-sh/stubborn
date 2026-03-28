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
package sh.stubborn.oss.mavenimport;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Method;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * @see <a href="../../../../../docs/specs/039-data-integrity.md">Spec 039 — Data
 * Integrity</a>
 */
class MavenJarDownloaderTest {

	/**
	 * Creates a ZIP archive where entries exceed 500 MB total uncompressed size. The
	 * entries are under contracts/ so they match the contract entry filter. Each entry is
	 * under MAX_ENTRY_SIZE (1 MB) individually, but together they exceed
	 * MAX_EXTRACTED_SIZE (500 MB).
	 */
	@Test
	void should_throw_when_total_extracted_size_exceeds_limit() throws Exception {
		// given — create a ZIP with many entries that total > 500 MB uncompressed
		// Each entry is ~1 MB (under the per-entry limit), need 501 of them
		byte[] zipBytes = createZipWithManyEntries(501, 1024 * 1024);

		// when/then — invoke extractContracts via reflection (it's private)
		Method extractMethod = MavenJarDownloader.class.getDeclaredMethod("extractContracts", byte[].class);
		extractMethod.setAccessible(true);

		MavenJarDownloader downloader = new MavenJarDownloader(org.springframework.web.client.RestClient.builder());

		assertThatThrownBy(() -> {
			try {
				extractMethod.invoke(downloader, zipBytes);
			}
			catch (java.lang.reflect.InvocationTargetException ex) {
				throw ex.getCause();
			}
		}).isInstanceOf(MavenImportException.class).hasMessageContaining("exceeded maximum size");
	}

	@Test
	void should_extract_contracts_within_size_limit() throws Exception {
		// given — create a ZIP with a few small entries (well under 500 MB)
		byte[] zipBytes = createZipWithManyEntries(3, 100);

		// when
		Method extractMethod = MavenJarDownloader.class.getDeclaredMethod("extractContracts", byte[].class);
		extractMethod.setAccessible(true);

		MavenJarDownloader downloader = new MavenJarDownloader(org.springframework.web.client.RestClient.builder());

		@SuppressWarnings("unchecked")
		List<MavenJarDownloader.ExtractedContract> result = (List<MavenJarDownloader.ExtractedContract>) extractMethod
			.invoke(downloader, zipBytes);

		// then
		assertThat(result).hasSize(3);
	}

	private static byte[] createZipWithManyEntries(int count, int entrySize) throws Exception {
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		try (ZipOutputStream zos = new ZipOutputStream(baos)) {
			byte[] content = new byte[entrySize];
			java.util.Arrays.fill(content, (byte) '{');
			// Make it valid-ish JSON
			content[entrySize - 1] = (byte) '}';
			for (int i = 0; i < count; i++) {
				ZipEntry entry = new ZipEntry("contracts/contract-" + i + ".json");
				zos.putNextEntry(entry);
				zos.write(content);
				zos.closeEntry();
			}
		}
		return baos.toByteArray();
	}

}
