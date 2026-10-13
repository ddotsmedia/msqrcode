import { useEffect, useState } from 'react';
import { api } from '../api';

interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  status: string;
  type: 'pickup' | 'dine_in';
  table_number?: string;
  items: any[];
}


export default function KitchenPage({ token, branchId }: { token: string; branchId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial orders
    api<Order[]>(`/orders?branch=${branchId}`, token)
      .then(setOrders)
      .catch((e: Error) => setError(e.message));

    // Connect to SSE stream (token passed as query param since EventSource doesn't support headers)
    const eventSource = new EventSource(`/api/orders/stream?token=${encodeURIComponent(token)}`);

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        setOrders((prev) => {
          const existing = prev.find((o) => o.id === update.id);
          if (existing) {
            existing.status = update.status;
            return [...prev];
          }
          return prev;
        });
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setError('Connection lost');
    };

    return () => eventSource.close();
  }, [token, branchId]);

  async function updateStatus(orderId: string, newStatus: string) {
    try {
      await api(`/admin/orders/${orderId}/status`, token, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const statuses = ['placed', 'paid', 'preparing', 'ready', 'completed'];
  const columns = statuses.map((status) => ({
    status,
    orders: orders.filter((o) => o.status === status),
  }));

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Kitchen Display</h1>
      {error && <p className="bg-red-900 text-red-100 rounded p-3 mb-4">{error}</p>}

      <div className="grid grid-cols-5 gap-4">
        {columns.map((col) => (
          <div key={col.status} className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-bold text-lg mb-4 uppercase">{col.status}</h2>
            <div className="space-y-3">
              {col.orders.map((order) => (
                <div key={order.id} className="bg-gray-700 rounded p-3 text-sm">
                  <p className="font-semibold">{order.order_no}</p>
                  <p className="text-xs text-gray-400">{order.customer_name}</p>
                  {order.type === 'dine_in' && order.table_number && (
                    <p className="text-xs text-yellow-400">Table {order.table_number}</p>
                  )}
                  <ul className="mt-2 text-xs space-y-1">
                    {order.items?.map((item, i) => (
                      <li key={i}>
                        {item.qty}x {item.name_snapshot}
                      </li>
                    ))}
                  </ul>

                  {col.status !== 'completed' && (
                    <div className="mt-3 flex gap-2">
                      {statuses.indexOf(col.status) < statuses.length - 1 && (
                        <button
                          onClick={() => updateStatus(order.id, statuses[statuses.indexOf(col.status) + 1])}
                          className="flex-1 bg-green-700 hover:bg-green-600 rounded px-2 py-1 text-xs font-semibold"
                        >
                          Next
                        </button>
                      )}
                      {col.status === 'ready' && (
                        <button
                          onClick={() => updateStatus(order.id, 'completed')}
                          className="flex-1 bg-blue-700 hover:bg-blue-600 rounded px-2 py-1 text-xs font-semibold"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <script>
        {`
          // Beep on new order
          window.orderSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==');
        `}
      </script>
    </div>
  );
}
