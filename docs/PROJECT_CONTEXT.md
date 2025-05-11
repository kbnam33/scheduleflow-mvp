# ScheduleFlow MVP Project Context

## Project Overview

ScheduleFlow is an AI-powered scheduling assistant designed for creative freelancers. It helps manage creative time blocks, meetings, and project workflows through an intuitive mobile interface.

## Technical Stack

### Mobile App
- **Framework:** Expo (Managed Workflow)
- **Language:** TypeScript
- **UI Library:** React Native
- **Styling:** NativeWind (TailwindCSS for React Native)
- **Navigation:** React Navigation
- **State Management:** React Context + AsyncStorage
- **API Client:** Axios

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **AI Integration:** OpenAI API

### Development Tools
- **Version Control:** Git + GitHub
- **CI/CD:** GitHub Actions
- **Build Service:** EAS (Expo Application Services)
- **Distribution:** App Store & Google Play

## Project Structure

```
scheduleflow-mvp/
├── app/                      # Main application code
│   ├── assets/              # Images, fonts, etc.
│   │   ├── common/         # Shared components
│   │   ├── forms/          # Form components
│   │   └── screens/        # Screen-specific components
│   ├── constants/          # App constants and theme
│   ├── hooks/              # Custom React hooks
│   ├── navigation/         # Navigation configuration
│   ├── screens/            # Screen components
│   ├── services/           # API and external services
│   ├── store/              # State management
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── server/                 # Backend server
│   ├── src/
│   │   ├── controllers/   # Route controllers
│   │   ├── middleware/    # Express middleware
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   └── utils/         # Server utilities
│   └── index.ts           # Server entry point
├── docs/                   # Documentation
│   ├── CONTEXT.md         # Project context
│   └── PROJECT_CONTEXT.md # Full MVP specification
└── .cursorrules/          # Cursor IDE rules
    ├── lessons.md         # Development lessons
    └── scratchpad.md      # Development notes
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'::jsonb
);
```

### Calendar Integrations Table
```sql
CREATE TABLE calendar_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'google', 'apple', 'outlook'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Video App Integrations Table
```sql
CREATE TABLE video_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'gmeet', 'zoom', 'teams'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'completed'
  priority INTEGER,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Time Blocks Table
```sql
CREATE TABLE time_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'creative', 'meeting', 'break'
  status VARCHAR(50) NOT NULL, -- 'suggested', 'confirmed', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Projects Table
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL, -- 'active', 'completed', 'archived'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Project Assets Table
```sql
CREATE TABLE project_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'file', 'link', 'note'
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Screen Specifications

### 1. Welcome & Authentication
- **Sign Up Screen**
  - Email input
  - Password creation
  - Password confirmation
  - Sign up button
- **Login Screen**
  - Email input
  - Password input
  - Login button
  - "Forgot Password" link

### 2. Calendar Integration
- **Calendar Connection Screen**
  - Google Calendar option
  - Apple Calendar option
  - Outlook Calendar option
  - Connection status indicators
  - Skip option

### 3. Video App Integration
- **Video Apps Screen**
  - Google Meet option
  - Zoom option
  - Microsoft Teams option
  - Connection status indicators
  - Skip option

### 4. User Preferences
- **Creative Time Screen**
  - Question: "At which part of the day are you most creative?"
  - Time range selector
  - Save button

- **Meeting Preferences Screen**
  - Question: "At which part of the day do you prefer attending meetings?"
  - Time range selector
  - Save button

### 5. Profile Completion
- **Professional Info Screen**
  - Question: "A quick info on what you do"
  - Text input area
  - Save button

### Navigation & UI
- Consistent bottom navigation bar
- Progress indicators for onboarding steps
- Branded color scheme and typography
- Intuitive button placement and sizing
- Clear call-to-action buttons
- Loading states and error handling

## Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow React Native best practices
- Implement proper error handling
- Write meaningful comments
- Use consistent naming conventions

### Git Workflow
- Feature branch workflow
- Meaningful commit messages
- Pull request reviews
- Regular merges to main branch

### Testing
- Unit tests for critical functions
- Integration tests for API endpoints
- UI component testing
- End-to-end testing for critical flows

### Performance
- Optimize bundle size
- Implement proper caching
- Use lazy loading where appropriate
- Monitor API response times

### Security
- Secure API endpoints
- Implement proper authentication
- Handle sensitive data appropriately
- Regular security audits

## Deployment

### Mobile App
1. Build with EAS
2. Test on internal distribution
3. Submit to app stores
4. Monitor crash reports

### Backend
1. Deploy to production server
2. Set up monitoring
3. Configure backups
4. Implement logging

## Future Considerations

### Phase 2 Features
- Advanced AI task generation
- Asset preparation automation
- Team collaboration features
- Advanced analytics

### Scalability
- Database optimization
- Caching strategy
- Load balancing
- CDN integration

### Maintenance
- Regular dependency updates
- Performance monitoring
- Security patches
- User feedback integration 