export interface ApplicationResponse {
  id: string;
  name: string;
  description: string;
  owner: string;
  mainBranch: string | null;
  repositoryUrl: string | null;
  createdAt: string;
}

export interface ContractResponse {
  id: string;
  applicationName: string;
  version: string;
  contractName: string;
  content: string;
  contentType: string;
  interactionType: string;
  createdAt: string;
}

export interface VerificationResponse {
  id: string;
  providerName: string;
  providerVersion: string;
  consumerName: string;
  consumerVersion: string;
  status: "SUCCESS" | "FAILED";
  details: string | null;
  verifiedAt: string;
}

export interface EnvironmentResponse {
  name: string;
  description: string | null;
  displayOrder: number;
  production: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentResponse {
  id: string;
  applicationName: string;
  version: string;
  environment: string;
  deployedAt: string;
}

export interface CanIDeployResponse {
  safe: boolean;
  application: string;
  version: string;
  environment: string;
  summary: string;
  consumerResults: ConsumerResult[];
}

export interface ConsumerResult {
  consumer: string;
  consumerVersion: string;
  verified: boolean;
}

export interface DependencyNode {
  applicationId: string;
  applicationName: string;
  owner: string;
}

export interface DependencyEdge {
  providerName: string;
  providerVersion: string;
  consumerName: string;
  consumerVersion: string;
  status: "SUCCESS" | "FAILED";
  verifiedAt: string;
}

export interface DependencyGraphResponse {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  messagingEdges: MessagingEdge[];
}

export interface ApplicationDependenciesResponse {
  applicationName: string;
  providers: DependencyEdge[];
  consumers: DependencyEdge[];
}

export interface WebhookResponse {
  id: string;
  applicationId: string | null;
  applicationName: string | null;
  eventType: EventType;
  url: string;
  headers: string | null;
  bodyTemplate: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EventType =
  | "CONTRACT_PUBLISHED"
  | "VERIFICATION_PUBLISHED"
  | "VERIFICATION_SUCCEEDED"
  | "VERIFICATION_FAILED"
  | "DEPLOYMENT_RECORDED";

export interface WebhookExecutionResponse {
  id: string;
  webhookId: string;
  eventType: EventType;
  requestUrl: string;
  requestBody: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  success: boolean;
  errorMessage: string | null;
  executedAt: string;
}

export interface MatrixEntry {
  providerName: string;
  providerVersion: string;
  consumerName: string;
  consumerVersion: string;
  status: "SUCCESS" | "FAILED";
  branch: string | null;
  verifiedAt: string;
}

export interface TagResponse {
  tag: string;
  version: string;
  createdAt: string;
}

export interface CleanupResult {
  deletedCount: number;
  deletedContracts: string[];
}

export interface ResolvedContract {
  consumerName: string;
  version: string;
  branch: string | null;
  contractName: string;
  contentHash: string | null;
}

export interface BrokerInfoResponse {
  edition: string;
  proEnabled: boolean;
  activeFeatures: string[];
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// Git Import types
export interface GitImportSourceResponse {
  id: string;
  applicationName: string;
  repositoryUrl: string;
  branch: string | null;
  contractsDirectory: string | null;
  authType: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncedCommit: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GitImportResultResponse {
  published: number;
  skipped: number;
  total: number;
  resolvedVersion: string;
}

export interface ImportGitRequest {
  applicationName: string;
  repositoryUrl: string;
  branch?: string;
  contractsDirectory?: string;
  version?: string;
  authType?: string;
  username?: string;
  token?: string;
}

export interface RegisterGitSourceRequest {
  applicationName: string;
  repositoryUrl: string;
  branch?: string;
  contractsDirectory?: string;
  authType?: string;
  username?: string;
  encryptedToken?: string;
  syncEnabled: boolean;
}

// Maven Import types
export interface MavenImportSourceResponse {
  id: string;
  repositoryUrl: string;
  groupId: string;
  artifactId: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncedVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MavenImportResultResponse {
  published: number;
  skipped: number;
  total: number;
}

// Topic topology types
export interface TopicParticipant {
  applicationName: string;
  version: string;
  contractName: string;
}

export interface TopicNode {
  topicName: string;
  publishers: TopicParticipant[];
}

export interface TopicTopologyResponse {
  topics: TopicNode[];
}

// Messaging edge in dependency graph
export interface MessagingEdge {
  applicationName: string;
  topicName: string;
  version: string;
}
