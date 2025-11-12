# Personal Finance Tracker with AI Insights

A full-stack web application for tracking personal finances with AI-powered insights, built with Next.js, Firebase, and TensorFlow.js.

## 🚀 Features

- **User Authentication**: Secure registration and login with Firebase Auth
- **Transaction Management**: Track income, expenses, and savings with full CRUD operations
- **Budget Tracking**: Set monthly budgets and monitor spending progress
- **AI-Powered Insights**: Get personalized financial recommendations and predictions
- **Visual Analytics**: View spending patterns and category breakdowns
- **User Profiles**: Customize preferences, currency, and financial goals

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes (Serverless)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **AI/ML**: TensorFlow.js (ready for integration)

## 📁 Project Structure

```
personal-finance-tracker/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── register/route.js
│       │   ├── login/route.js
│       │   ├── logout/route.js
│       │   └── verify/route.js
│       ├── transactions/
│       │   ├── route.js
│       │   ├── [id]/route.js
│       │   └── stats/route.js
│       ├── user/
│       │   ├── profile/route.js
│       │   ├── budget/route.js
│       │   └── settings/route.js
│       └── insights/
│           ├── route.js
│           └── history/route.js
├── lib/
│   ├── firebase/
│   │   ├── config.js
│   │   └── admin.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── utils/
│   │   ├── responseFormatter.js
│   │   ├── errorHandler.js
│   │   └── validators.js
│   └── ai/
│       └── insightsEngine.js
├── .env.local.example
├── package.json
└── README.md
```

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd personal-finance-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable **Authentication** (Email/Password provider)
4. Create a **Firestore Database**
5. Generate credentials:
   - **Client SDK**: Project Settings > General > Your apps
   - **Admin SDK**: Project Settings > Service Accounts > Generate New Private Key

### 4. Set Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 5. Configure Firestore Security Rules

In Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Transactions collection
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Insights collection
    match /insights/{insightId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

### 6. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/verify` - Verify token

### Transactions

- `GET /api/transactions` - Get all transactions (with filters)
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/[id]` - Get specific transaction
- `PUT /api/transactions/[id]` - Update transaction
- `DELETE /api/transactions/[id]` - Delete transaction
- `GET /api/transactions/stats` - Get transaction statistics

### User Profile

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/budget` - Get budget status
- `POST /api/user/budget` - Update budget goals
- `GET /api/user/settings` - Get user settings
- `PUT /api/user/settings` - Update user settings

### AI Insights

- `GET /api/insights` - Generate AI insights
- `POST /api/insights` - Save feedback on insights
- `GET /api/insights/history` - Get historical insights

## 🔐 Authentication Flow

All protected endpoints require a Firebase ID token in the Authorization header:

```javascript
const idToken = await firebase.auth().currentUser.getIdToken();

fetch('/api/transactions', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

## 🤖 AI Insights

The AI insights engine analyzes your financial data and provides:

- **Spending Analysis**: Category breakdowns and patterns
- **Personalized Recommendations**: Actionable tips to improve finances
- **Budget Alerts**: Warnings when approaching budget limits
- **Savings Tips**: Suggestions to increase savings
- **Predictions**: Forecast future expenses (ready for TensorFlow.js model)
- **Spending Score**: Overall financial health score (0-100)

### Integrating TensorFlow.js Model

The AI engine is structured to accept a TensorFlow.js model. To integrate:

1. Train your model and export to TensorFlow.js format
2. Update `lib/ai/insightsEngine.js`:

```javascript
import * as tf from '@tensorflow/tfjs';

export async function loadTensorFlowModel() {
  const model = await tf.loadLayersModel('file://path/to/model.json');
  return model;
}

export async function predictWithModel(model, inputData) {
  const tensor = tf.tensor2d([inputData]);
  const prediction = model.predict(tensor);
  return prediction.dataSync();
}
```

## 📊 Firestore Collections

### users
```javascript
{
  uid: string,
  email: string,
  name: string,
  currency: string,
  monthlyBudget: number,
  savingsGoal: number,
  preferences: {
    notifications: boolean,
    theme: string,
    language: string
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### transactions
```javascript
{
  userId: string,
  type: 'income' | 'expense' | 'savings',
  amount: number,
  category: string,
  description: string,
  date: timestamp,
  tags: string[],
  recurring: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### insights
```javascript
{
  userId: string,
  period: string,
  insights: object,
  createdAt: timestamp,
  feedback: {
    rating: number,
    helpful: boolean,
    comment: string
  }
}
```

## 🧪 Testing API Endpoints

### Example: Create Transaction

```javascript
const idToken = await firebase.auth().currentUser.getIdToken();

const response = await fetch('/api/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    type: 'expense',
    amount: 50.00,
    category: 'Food',
    description: 'Grocery shopping',
    date: '2024-01-15',
    tags: ['groceries', 'weekly']
  })
});

const data = await response.json();
console.log(data);
```

### Example: Get AI Insights

```javascript
const response = await fetch('/api/insights?period=month', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});

const data = await response.json();
console.log(data.insights);
```

## 🚀 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

### Deploy to Other Platforms

The app is compatible with any platform supporting Next.js:
- Netlify
- AWS Amplify
- Google Cloud Run
- Railway

## 📝 Best Practices

- **Security**: Never commit `.env.local` or Firebase credentials
- **Error Handling**: All endpoints use centralized error handling
- **Validation**: Input validation on all user data
- **Authentication**: Token verification on all protected routes
- **Rate Limiting**: Consider adding rate limiting in production
- **Monitoring**: Set up logging and error tracking (e.g., Sentry)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🆘 Support

For issues or questions:
- Open an issue on GitHub
- Check Firebase documentation
- Review Next.js documentation

## 🎯 Roadmap

- [ ] Add data export functionality
- [ ] Implement recurring transactions
- [ ] Add multi-currency support
- [ ] Create mobile app with React Native
- [ ] Integrate real TensorFlow.js ML model
- [ ] Add data visualization dashboard
- [ ] Implement bill reminders
- [ ] Add receipt scanning with OCR

---

Built with ❤️ using Next.js, Firebase, and TensorFlow.js
