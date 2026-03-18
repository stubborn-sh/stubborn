/** Application registered in the broker. */
export interface ApplicationResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly owner: string;
  readonly mainBranch: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Request to register a new application. */
export interface RegisterApplicationRequest {
  readonly name: string;
  readonly owner: string;
  readonly description?: string;
  readonly mainBranch?: string;
}

/** Request to update an application's main branch. */
export interface UpdateApplicationRequest {
  readonly mainBranch: string;
}

/** Published contract/stub. */
export interface ContractResponse {
  readonly id: string;
  readonly version: string;
  readonly contractName: string;
  readonly content: string;
  readonly contentType: string;
  readonly createdAt: string;
}

/** Request to publish a contract. */
export interface PublishContractRequest {
  readonly contractName: string;
  readonly content: string;
  readonly contentType: string;
}

/** Verification status. */
export type VerificationStatus = "SUCCESS" | "FAILED";

/** Verification result. */
export interface VerificationResponse {
  readonly id: string;
  readonly providerName: string;
  readonly providerVersion: string;
  readonly consumerName: string;
  readonly consumerVersion: string;
  readonly status: VerificationStatus;
  readonly details: string | null;
  readonly verifiedAt: string;
}

/** Request to record a verification result. */
export interface RecordVerificationRequest {
  readonly providerName: string;
  readonly providerVersion: string;
  readonly consumerName: string;
  readonly consumerVersion: string;
  readonly status: VerificationStatus;
  readonly details?: string;
}

/** Environment configuration. */
export interface EnvironmentResponse {
  readonly name: string;
  readonly description: string | null;
  readonly displayOrder: number;
  readonly production: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Request to create an environment. */
export interface CreateEnvironmentRequest {
  readonly name: string;
  readonly displayOrder: number;
  readonly production: boolean;
  readonly description?: string;
}

/** Request to update an environment. */
export interface UpdateEnvironmentRequest {
  readonly displayOrder: number;
  readonly production: boolean;
  readonly description?: string;
}

/** Deployment record. */
export interface DeploymentResponse {
  readonly id: string;
  readonly applicationName: string;
  readonly environment: string;
  readonly version: string;
  readonly deployedAt: string;
}

/** Request to record a deployment. */
export interface RecordDeploymentRequest {
  readonly applicationName: string;
  readonly version: string;
}

/** Can-I-Deploy safety check result. */
export interface CanIDeployResponse {
  readonly application: string;
  readonly version: string;
  readonly environment: string;
  readonly safe: boolean;
  readonly summary: string;
  readonly consumerResults: readonly ConsumerResult[];
}

/** Individual consumer verification result in a can-i-deploy check. */
export interface ConsumerResult {
  readonly consumer: string;
  readonly consumerVersion: string;
  readonly verified: boolean;
}

/** Dependency graph node. */
export interface DependencyNode {
  readonly applicationId: string;
  readonly applicationName: string;
  readonly owner: string;
}

/** Dependency graph edge. */
export interface DependencyEdge {
  readonly providerName: string;
  readonly providerVersion: string;
  readonly consumerName: string;
  readonly consumerVersion: string;
  readonly status: VerificationStatus;
  readonly verifiedAt: string;
}

/** Full dependency graph. */
export interface DependencyGraphResponse {
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
}

/** Application-specific dependencies. */
export interface ApplicationDependenciesResponse {
  readonly applicationName: string;
  readonly providers: readonly DependencyEdge[];
  readonly consumers: readonly DependencyEdge[];
}

/** Event types that can trigger webhooks. */
export type EventType =
  | "CONTRACT_PUBLISHED"
  | "VERIFICATION_PUBLISHED"
  | "VERIFICATION_SUCCEEDED"
  | "VERIFICATION_FAILED"
  | "DEPLOYMENT_RECORDED";

/** Webhook configuration. */
export interface WebhookResponse {
  readonly id: string;
  readonly applicationId: string | null;
  readonly applicationName: string | null;
  readonly eventType: EventType;
  readonly url: string;
  readonly headers: string | null;
  readonly bodyTemplate: string | null;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Request to create a webhook. */
export interface CreateWebhookRequest {
  readonly eventType: EventType;
  readonly url: string;
  readonly applicationName?: string;
  readonly headers?: string;
  readonly bodyTemplate?: string;
}

/** Request to update a webhook. */
export interface UpdateWebhookRequest {
  readonly eventType: EventType;
  readonly url: string;
  readonly headers?: string;
  readonly bodyTemplate?: string;
  readonly enabled?: boolean;
}

/** Webhook execution log entry. */
export interface WebhookExecutionResponse {
  readonly id: string;
  readonly webhookId: string;
  readonly eventType: EventType;
  readonly requestUrl: string;
  readonly requestBody: string | null;
  readonly responseStatus: number | null;
  readonly responseBody: string | null;
  readonly success: boolean;
  readonly errorMessage: string | null;
  readonly executedAt: string;
}

/** Compatibility matrix entry. */
export interface MatrixEntry {
  readonly providerName: string;
  readonly providerVersion: string;
  readonly consumerName: string;
  readonly consumerVersion: string;
  readonly status: VerificationStatus;
  readonly branch: string | null;
  readonly verifiedAt: string;
}

/** Consumer version selector for contract resolution. */
export interface ConsumerVersionSelector {
  readonly mainBranch?: boolean;
  readonly branch?: string;
  readonly consumer?: string;
  readonly deployed?: boolean;
  readonly environment?: string;
}

/** Resolved contract from selector resolution. */
export interface ResolvedContract {
  readonly consumerName: string;
  readonly version: string;
  readonly branch: string | null;
  readonly contractName: string;
  readonly contentHash: string | null;
}

/** Version tag. */
export interface TagResponse {
  readonly tag: string;
  readonly version: string;
  readonly createdAt: string;
}

/** Data cleanup request. */
export interface CleanupRequest {
  readonly keepLatestVersions: number;
  readonly applicationName?: string;
  readonly protectedEnvironments?: readonly string[];
}

/** Data cleanup result. */
export interface CleanupResult {
  readonly deletedCount: number;
  readonly deletedContracts: readonly string[];
}

/** Spring Data page response. */
export interface Page<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

/** Common pagination parameters. */
export interface PageParams {
  readonly page?: number;
  readonly size?: number;
  readonly sort?: string;
}

/** List parameters with search. */
export interface ListParams extends PageParams {
  readonly search?: string;
}

/** Error response from the broker API. */
export interface ErrorResponse {
  readonly code: string;
  readonly message: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly details: Readonly<Record<string, string>>;
}
