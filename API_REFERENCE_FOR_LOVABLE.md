# Personal Finance Tracker – Backend API Reference (Lovable Handoff)

This document summarizes every backend endpoint exposed by the Next.js + Firebase stack. Lovable (frontend) can rely on these routes for all data operations.

---

## 🔐 Authentication Flow Overview

1. **Register** a user (`POST /api/auth/register`).
2. **Login** with email/password (`POST /api/auth/login`) – returns a Firebase **ID token** plus refresh token.
3. Include the ID token in the `Authorization: Bearer <ID_TOKEN>` header for every protected route.
4. Use `POST /api/auth/logout` to revoke refresh tokens when signing out.
5. Optional: `GET /api/auth/verify` validates the current token without performing an operation.

> All protected routes return `401 Unauthorized` if the token is missing or invalid.

### Response Envelope Format
```json
{
  "success": true,
  "message": "Human‑friendly status",
  "data": {},
  "timestamp": "ISO-8601"
}
```
Errors follow the same shape with `success: false` and optional `errors` field.

---

## 📁 Collections in Firestore
- `users` – profile, preferences, budget goals.
- `transactions` – income/expense/savings entries.
- `insights` – generated AI insight snapshots + feedback.

All server routes automatically scope to `request.user.uid` extracted from the ID token.

---

## 1. Authentication Endpoints

### 1.1 Register User
`POST /api/auth/register`

**Body**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Success (201)**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "uid": "nlILNDJtNDQkaOIIl8EYqk7owT73",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "timestamp": "2025-11-12T19:48:45.532Z"
}
```

**Common Errors**
- `400` – invalid email/password/name
- `400` – email already in use

---

### 1.2 Login User
`POST /api/auth/login`

**Body**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success (200)**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "uid": "nlILNDJtNDQkaOIIl8EYqk7owT73",
    "email": "user@example.com",
    "name": "John Doe",
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MDI5MzRmZTBlZWM0NmE1ZWQwMDA2ZDE0YTFiYWIwMWUzNDUwODMiLCJ0eXAiOiJKV1QifQ...",
    "refreshToken": "AEu4Il2...",
    "expiresIn": "3600",
    "profile": {
      "currency": "USD",
      "monthlyBudget": 0,
      "savingsGoal": 0,
      "preferences": {
        "notifications": true,
        "theme": "light",
        "language": "en"
      }
    }
  },
  "timestamp": "2025-11-12T19:22:27.025Z"
}
```

**Errors**
- `401` – `EMAIL_NOT_FOUND`, `INVALID_PASSWORD`, or `USER_DISABLED`
- `500` – missing Firebase API key (configuration issue)

---

### 1.3 Logout User
`POST /api/auth/logout`

**Headers**: `Authorization: Bearer <ID_TOKEN>`

**Success (200)**
```json
{
  "success": true,
  "message": "Logout successful",
  "data": {
    "uid": "nlILNDJtNDQkaOIIl8EYqk7owT73"
  },
  "timestamp": "2025-11-12T19:23:01.734Z"
}
```

If the token is already invalid/expired, the route returns `200` with message `"Already logged out"`.

---

### 1.4 Verify Token
`GET /api/auth/verify`

**Headers**: `Authorization: Bearer <ID_TOKEN>`

**Success (200)**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "uid": "nlILNDJtNDQkaOIIl8EYqk7owT73",
    "email": "user@example.com",
    "emailVerified": false,
    "name": "John Doe"
  },
  "timestamp": "2025-11-12T19:24:05.138Z"
}
```

**Errors**
- `401` – missing/invalid token

---

## 2. Transaction Endpoints

### 2.1 List Transactions
`GET /api/transactions?type=expense&page=1&limit=10&startDate=2025-01-01&endDate=2025-01-31`

**Headers**: `Authorization: Bearer <ID_TOKEN>`

**Success (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "transactions": [
      {
        "id": "trans_001",
        "userId": "nlILNDJtNDQkaOIIl8EYqk7owT73",
        "type": "expense",
        "amount": 42.5,
        "category": "Food",
        "description": "Lunch at cafe",
        "date": "2025-01-12T12:15:00.000Z",
        "tags": ["lunch", "eating out"],
        "recurring": false,
        "createdAt": "2025-01-12T12:20:30.100Z",
        "updatedAt": "2025-01-12T12:20:30.100Z"
      }
    ],
    "summary": {
      "totalIncome": 2500,
      "totalExpenses": 850,
      "totalSavings": 200,
      "count": 12
    },
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 12,
      "totalPages": 2
    }
  },
  "timestamp": "2025-11-12T19:30:12.441Z"
}
```

**Errors**
- `401` – invalid token

---

### 2.2 Create Transaction
`POST /api/transactions`

**Headers**: `Authorization: Bearer <ID_TOKEN>`

**Body**
```json
{
  "type": "expense",
  "amount": 42.5,
  "category": "Food",
  "description": "Lunch at cafe",
  "date": "2025-01-12",
  "tags": ["lunch", "eating out"],
  "recurring": false
}
```

**Success (201)**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "id": "trans_ABC123",
    "userId": "nlILNDJtNDQkaOIIl8EYqk7owT73",
    "type": "expense",
    "amount": 42.5,
    "category": "Food",
    "description": "Lunch at cafe",
    "date": "2025-01-12T00:00:00.000Z",
    "tags": ["lunch", "eating out"],
    "recurring": false,
    "createdAt": "2025-11-12T19:31:22.804Z",
    "updatedAt": "2025-11-12T19:31:22.804Z"
  },
  "timestamp": "2025-11-12T19:31:22.804Z"
}
```

**Errors**
- `400` – validation errors (missing fields, invalid amount/type)
- `401` – invalid token

---

### 2.3 Get Transaction by ID
`GET /api/transactions/{transactionId}`

**Success (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "trans_ABC123",
    "userId": "nlILNDJtNDQkaOIIl8EYqk7owT73",
    "type": "expense",
    "amount": 42.5,
    "category": "Food",
    "description": "Lunch at cafe",
    "date": "2025-01-12T00:00:00.000Z",
    "tags": ["lunch", "eating out"],
    "recurring": false,
    "createdAt": "2025-11-12T19:31:22.804Z",
    "updatedAt": "2025-11-12T19:31:22.804Z"
  },
  "timestamp": "2025-11-12T19:32:05.511Z"
}
```

**Errors**
- `403` – requesting another user’s transaction
- `404` – transaction not found

---

### 2.4 Update Transaction
`PUT /api/transactions/{transactionId}`

**Body** (partial updates allowed)
```json
{
  "amount": 55,
  "description": "Updated lunch expense"
}
```

**Success (200)**
```json
{
  "success": true,
  "message": "Transaction updated successfully",
  "data": {
    "id": "trans_ABC123",
    "userId": "nlILNDJtNDQkaOIIl8EYqk7owT73",
    "type": "expense",
    "amount": 55,
    "category": "Food",
    "description": "Updated lunch expense",
    "date": "2025-01-12T00:00:00.000Z",
    "tags": ["lunch", "eating out"],
    "recurring": false,
    "createdAt": "2025-11-12T19:31:22.804Z",
    "updatedAt": "2025-11-12T19:35:42.203Z"
  },
  "timestamp": "2025-11-12T19:35:42.203Z"
}
```

---

### 2.5 Delete Transaction
`DELETE /api/transactions/{transactionId}`

**Success (200)**
```json
{
  "success": true,
  "message": "Transaction deleted successfully",
  "data": {
    "id": "trans_ABC123"
  },
  "timestamp": "2025-11-12T19:36:12.990Z"
}
```

---

### 2.6 Transaction Stats
`GET /api/transactions/stats?period=month&year=2025&month=1`

**Success (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "period": "month",
    "dateRange": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-01-31T23:59:59.000Z"
    },
    "summary": {
      "totalIncome": 5000,
      "totalExpenses": 3200,
      "totalSavings": 800,
      "netBalance": 1000,
      "transactionCount": 45
    },
    "byType": {
      "income": { "count": 10, "total": 5000 },
      "expense": { "count": 30, "total": 3200 },
      "savings": { "count": 5, "total": 800 }
    },
    "topCategories": [
      {
        "category": "Food",
        "total": 800,
        "count": 12,
        "percentage": "25.00"
      }
    ],
    "monthlyTrend": [
      {
        "month": "2025-01",
        "income": 5000,
        "expense": 3200,
        "savings": 800,
        "net": 1000
      }
    ]
  },
  "timestamp": "2025-11-12T19:37:58.440Z"
}
```

---

## 3. User Module

### 3.1 Get Profile
`GET /api/user/profile`

**Success (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "uid": "nlILNDJtNDQkaOIIl8EYqk7owT73",
    "email": "user@example.com",
    "name": "John Doe",
    "currency": "USD",
    "monthlyBudget": 3000,
    "savingsGoal": 10000,
    "preferences": {
      "notifications": true,
      "theme": "dark",
      "language": "en"
    },
    "createdAt": "2025-01-10T09:12:41.110Z",
    "lastLogin": "2025-11-12T19:22:27.025Z"
  },
  "timestamp": "2025-11-12T19:38:42.655Z"
}
```

---

### 3.2 Update Profile
`PUT /api/user/profile`

**Body**
```json
{
  "name": "Jane Doe",
  "currency": "EUR",
  "monthlyBudget": 2750,
  "savingsGoal": 15000,
  "preferences": {
    "notifications": true,
    "theme": "dark",
    "language": "en"
  }
}
```

**Success (200)**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "uid": "nlILNDJtNDQkaOIIl8EYqk7owT73",
    "email": "user@example.com",
    "name": "Jane Doe",
    "currency": "EUR",
    "monthlyBudget": 2750,
    "savingsGoal": 15000,
    "preferences": {
      "notifications": true,
      "theme": "dark",
      "language": "en"
    }
  },
  "timestamp": "2025-11-12T19:39:33.912Z"
}
```

---

### 3.3 Get Budget Status
`GET /api/user/budget?month=1&year=2025`

**Success (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "period": {
      "month": 1,
      "year": 2025,
      "daysRemaining": 15
    },
    "budget": {
      "monthly": 3000,
      "spent": 2100,
      "remaining": 900,
      "percentageUsed": 70,
      "dailyBudget": 60,
      "status": "on_track"
    },
    "categoryBreakdown": [
      {
        "category": "Food",
        "amount": 800,
        "percentage": "38.10"
      }
    ]
  },
  "timestamp": "2025-11-12T19:41:12.010Z"
}
```

---

### 3.4 Update Budget Goals
`POST /api/user/budget`

**Body**
```json
{
  "monthlyBudget": 3200,
  "savingsGoal": 12000,
  "categoryBudgets": {
    "Food": 600,
    "Transport": 250,
    "Entertainment": 150
  }
}
```

**Success (200)**
```json
{
  "success": true,
  "message": "Budget goals updated successfully",
  "data": {
    "monthlyBudget": 3200,
    "savingsGoal": 12000,
    "categoryBudgets": {
      "Food": 600,
      "Transport": 250,
      "Entertainment": 150
    },
    "updatedAt": "2025-11-12T19:42:24.776Z"
  },
  "timestamp": "2025-11-12T19:42:24.776Z"
}
```

---

### 3.5 Get Settings
`GET /api/user/settings`

**Success (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "preferences": {
      "notifications": true,
      "theme": "dark",
      "language": "en",
      "emailNotifications": true,
      "budgetAlerts": true
    },
    "currency": "USD"
  },
  "timestamp": "2025-11-12T19:43:17.561Z"
}
```

---

### 3.6 Update Settings
`PUT /api/user/settings`

**Body**
```json
{
  "preferences": {
    "notifications": true,
    "theme": "auto",
    "language": "en",
    "emailNotifications": false,
    "budgetAlerts": true
  },
  "currency": "USD"
}
```

**Success (200)**
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "preferences": {
      "notifications": true,
      "theme": "auto",
      "language": "en",
      "emailNotifications": false,
      "budgetAlerts": true
    },
    "currency": "USD",
    "updatedAt": "2025-11-12T19:44:02.901Z"
  },
  "timestamp": "2025-11-12T19:44:02.901Z"
}
```

---

## 4. AI Insights Module

### 4.1 Generate Insights
`GET /api/insights?period=month&includeHistory=true`

**Success (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "period": "month",
    "dateRange": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-01-31T23:59:59.000Z"
    },
    "insights": {
      "summary": {
        "monthlyIncome": 5000,
        "monthlyExpenses": 3200,
        "monthlySavings": 800,
        "savingsRate": 16,
        "netCashFlow": 1000,
        "transactionCount": 45
      },
      "recommendations": [
        {
          "type": "reduce_spending",
          "priority": "high",
          "category": "Food",
          "message": "Your Food expenses are 35% of total spending. Consider reducing by 10-15%.",
          "potentialSavings": 120
        }
      ],
      "predictions": {
        "nextMonthExpenses": 3150,
        "confidence": 0.75,
        "trend": "stable",
        "method": "moving_average"
      },
      "alerts": [
        {
          "type": "budget_warning",
          "severity": "warning",
          "message": "You've used 75% of your monthly budget."
        }
      ],
      "savingsTips": [
        {
          "category": "Food",
          "tip": "Meal planning and cooking at home can reduce food costs by 30-40%.",
          "estimatedSavings": 280
        }
      ],
      "categoryAnalysis": {
        "Food": {
          "total": 800,
          "count": 12,
          "avgTransaction": 66.67,
          "trend": "stable"
        }
      },
      "spendingScore": 72
    },
    "historicalInsights": [
      {
        "id": "insight_001",
        "period": "month",
        "summary": {
          "monthlyIncome": 4500,
          "monthlyExpenses": 3000,
          "monthlySavings": 700,
          "netCashFlow": 800,
          "transactionCount": 40
        },
        "spendingScore": 68,
        "recommendationCount": 4,
        "createdAt": "2024-12-15T10:10:00.000Z",
        "feedback": {
          "rating": 5,
          "helpful": true,
          "comment": "Great advice!"
        }
      }
    ],
    "metadata": {
      "transactionCount": 45,
      "generatedAt": "2025-11-12T19:45:36.421Z",
      "aiEnabled": true
    }
  },
  "timestamp": "2025-11-12T19:45:36.421Z"
}
```

---

### 4.2 Submit Insight Feedback
`POST /api/insights`

**Body**
```json
{
  "insightId": "insight_001",
  "rating": 5,
  "helpful": true,
  "feedback": "Very helpful recommendations!"
}
```

**Success (200)**
```json
{
  "success": true,
  "message": "Feedback saved successfully",
  "data": {
    "insightId": "insight_001",
    "feedbackSaved": true
  },
  "timestamp": "2025-11-12T19:46:14.902Z"
}
```

---

### 4.3 Insight History
`GET /api/insights/history?page=1&limit=5`

**Success (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "insights": [
      {
        "id": "insight_001",
        "period": "month",
        "summary": {
          "monthlyIncome": 4500,
          "monthlyExpenses": 3000,
          "monthlySavings": 700,
          "netCashFlow": 800,
          "transactionCount": 40
        },
        "spendingScore": 68,
        "recommendationCount": 4,
        "createdAt": "2024-12-15T10:10:00.000Z",
        "feedback": {
          "rating": 5,
          "helpful": true,
          "comment": "Great advice!"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 5,
      "total": 1
    }
  },
  "timestamp": "2025-11-12T19:47:05.300Z"
}
```

---

### 4.4 Analyze Spending (Chatbot Style)
`POST /api/insights/analyze`

**Body**
```json
{
  "transactions": [
    {
      "type": "expense",
      "amount": 50,
      "category": "Food",
      "date": "2025-01-10"
    },
    {
      "type": "expense",
      "amount": 100,
      "category": "Shopping",
      "date": "2025-01-11"
    },
    {
      "type": "income",
      "amount": 2000,
      "category": "Salary",
      "date": "2025-01-01"
    }
  ],
  "period": "last_30_days"
}
```

**Success (200)**
```json
{
  "success": true,
  "message": "Analysis completed successfully",
  "data": {
    "analysis": {
      "hasData": true,
      "insights": [
        {
          "type": "greeting",
          "message": "Hi! I've analyzed 3 transactions. Here's what I found:",
          "icon": "👋"
        },
        {
          "type": "spending_overview",
          "message": "You've spent $150.00 across 2 transactions.",
          "icon": "💰",
          "data": {
            "totalExpenses": 150,
            "transactionCount": 2
          }
        },
        {
          "type": "top_category",
          "message": "Your biggest expense is **Shopping** at $100.00 (67% of total spending).",
          "icon": "📊",
          "data": {
            "category": "Shopping",
            "amount": 100,
            "percentage": "67"
          }
        },
        {
          "type": "recommendation",
          "message": "💡 **Tip**: Shopping takes up a large portion of your budget. Consider setting a monthly limit or finding ways to reduce costs in this area.",
          "icon": "💡",
          "priority": "high"
        },
        {
          "type": "savings_progress",
          "message": "You're saving 0.0% of your income. Try to increase this to 20% for better financial security.",
          "icon": "📈",
          "priority": "medium",
          "data": {
            "savingsRate": 0,
            "target": 20
          }
        },
        {
          "type": "summary",
          "message": "That's your spending analysis! Keep tracking your expenses and I'll help you make smarter financial decisions. 🚀",
          "icon": "✨"
        }
      ],
      "summary": {
        "totalTransactions": 3,
        "totalExpenses": 150,
        "totalIncome": 2000,
        "totalSavings": 0,
        "topCategories": [
          {
            "category": "Shopping",
            "amount": 100
          },
          {
            "category": "Food",
            "amount": 50
          }
        ]
      }
    },
    "metadata": {
      "analyzedTransactions": 3,
      "generatedAt": "2025-11-12T23:15:42.100Z",
      "mlModel": "heuristic_v1"
    }
  },
  "timestamp": "2025-11-12T23:15:42.100Z"
}
```

**Notes:**
- If `transactions` array is empty, the API fetches the last 30 days of transactions from Firestore.
- Returns chatbot-style insights with icons and priority levels.
- Analysis is saved to `insights` collection for history tracking.
- TensorFlow.js runs on the server lazily (`@tensorflow/tfjs`) to calculate variance, risk score, and spending projections. If TF.js fails to load, the API falls back to heuristic-only insights and sets `metadata.mlModel` accordingly.

---

## 🔄 Token Refresh Strategy
- When `idToken` expires (`expiresIn` ≈ 1 hour), Lovable should call Firebase Auth SDK’s `onIdTokenChanged` or `getIdToken(true)` to refresh using `refreshToken`.
- Backend routes simply require a valid ID token; no refresh handling serverside.

---

## ⚠️ Error Handling Summary
| HTTP Code | Description | Typical Cause |
|-----------|-------------|----------------|
| 200/201   | Success     | Operation completed |
| 400       | Bad request | Validation errors, malformed parameters |
| 401       | Unauthorized| Missing/invalid ID token |
| 403       | Forbidden   | Accessing another user’s resource |
| 404       | Not found   | Requested document missing |
| 500       | Server error| Configuration issues (e.g., missing API key) |

All responses include a descriptive `message` field that Lovable can surface to users.

---

## ✅ Checklist for Lovable Integration
- [ ] Call `/api/auth/register` once to create user + Firestore profile.
- [ ] Use `/api/auth/login` to retrieve ID token and profile data.
- [ ] Store `idToken` client-side and send with every protected request.
- [ ] Use provided sample payloads to shape request bodies.
- [ ] Handle error messages gracefully (display `message`).
- [ ] Refresh ID token periodically via Firebase Auth SDK.
- [ ] Leverage AI insight summaries for dashboard tips; historical data available via `/api/insights/history`.

This file contains the full contract needed for the Lovable team to consume the backend safely.
