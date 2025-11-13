export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Money Tracker API</h1>
      <p>Welcome to the Money Tracker Backend API.</p>
      
      <section style={{ marginTop: '2rem' }}>
        <h2>Available Endpoints:</h2>
        <ul>
          <li><strong>POST /api/auth/register</strong> - Register a new user</li>
          <li><strong>GET /api/auth/verify</strong> - Verify authentication token</li>
          <li><strong>GET /api/transactions</strong> - Get all transactions</li>
          <li><strong>POST /api/transactions</strong> - Create a new transaction</li>
          <li><strong>GET /api/transactions/[id]</strong> - Get transaction by ID</li>
          <li><strong>PUT /api/transactions/[id]</strong> - Update transaction</li>
          <li><strong>DELETE /api/transactions/[id]</strong> - Delete transaction</li>
          <li><strong>GET /api/transactions/stats</strong> - Get transaction statistics</li>
          <li><strong>GET /api/user/profile</strong> - Get user profile</li>
          <li><strong>PUT /api/user/profile</strong> - Update user profile</li>
          <li><strong>GET /api/user/budget</strong> - Get budget information</li>
          <li><strong>PUT /api/user/budget</strong> - Update budget</li>
          <li><strong>GET /api/insights/analyze</strong> - Get AI-powered insights</li>
          <li><strong>POST /api/ai/chat</strong> - Chat with AI assistant</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Documentation</h3>
        <p>For detailed API documentation, please refer to the API_REFERENCE_FOR_LOVABLE.md file.</p>
      </section>
    </main>
  );
}
