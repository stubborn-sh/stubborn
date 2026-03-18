/** HTTP client for the Order Service (Java maven-producer). */

export interface Order {
  readonly id: string;
  readonly product: string;
  readonly amount: number;
  readonly status: string;
}

export class OrderServiceClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getOrder(id: string): Promise<Order> {
    const response = await fetch(`${this.baseUrl}/api/orders/${id}`);
    if (!response.ok) {
      throw new Error(`GET /api/orders/${id} failed: ${response.status}`);
    }
    return (await response.json()) as Order;
  }

  async createOrder(product: string, amount: number): Promise<Order> {
    const response = await fetch(`${this.baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, amount }),
    });
    if (!response.ok) {
      throw new Error(`POST /api/orders failed: ${response.status}`);
    }
    return (await response.json()) as Order;
  }
}
