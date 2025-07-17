# 🧪 Manual Testing Checklist for AlwayZ

## Before You Start
- [ ] Preview server is running (`npm run preview`)
- [ ] Open browser to `http://localhost:4173`
- [ ] Open browser developer tools (F12)
- [ ] Check console for any errors

---

## 1. 🏠 Landing Page Testing

### Visual Check
- [ ] AlwayZ logo and branding visible
- [ ] "Keep Their Memory Alive" tagline present
- [ ] Hero section looks good
- [ ] Features section displays correctly
- [ ] Trust/security section visible
- [ ] Navigation menu works

### Functionality
- [ ] "Get Started" button works
- [ ] "Sign In" button opens modal
- [ ] Navigation links work
- [ ] Mobile menu works (resize browser)
- [ ] Responsive design on different screen sizes

---

## 2. 🔐 Authentication Testing

### Sign Up Flow
- [ ] Click "Sign In" → "Sign Up"
- [ ] Fill form with test data:
  - Name: "Test User"
  - Email: "test@example.com"
  - Password: "testpass123"
- [ ] Submit form
- [ ] Check for success message
- [ ] Verify user appears in Supabase Auth dashboard

### Sign In Flow
- [ ] Use same credentials to sign in
- [ ] Verify successful login
- [ ] Check user stays logged in on page refresh
- [ ] Test logout functionality

---

## 3. 👤 Persona Creation Testing

### Create New Persona
- [ ] Click "Create New Persona"
- [ ] Fill out form:
  - Name: "Test Grandma"
  - Relationship: "Grandparent"
  - Description: "My loving grandmother"
  - Personality: "Warm, caring, loves to tell stories"
  - Common phrases: "You know what I mean?, Back in my day"
- [ ] Submit form
- [ ] Verify persona appears in dashboard
- [ ] Check persona status shows "training"

### Persona Management
- [ ] View persona details
- [ ] Edit persona information
- [ ] Check persona appears in database (Supabase dashboard)

---

## 4. 📁 File Upload Testing

### Upload Different File Types
- [ ] Select persona → "Setup Training"
- [ ] Test uploading:
  - [ ] Image file (.jpg, .png) - max 10MB
  - [ ] Video file (.mp4, .mov) - max 100MB
  - [ ] Audio file (.mp3, .wav) - max 50MB
  - [ ] Document (.pdf, .txt) - max 10MB

### Upload Process
- [ ] Drag and drop works
- [ ] Click to browse works
- [ ] Progress indicators show
- [ ] Files appear in uploaded list
- [ ] File status updates (uploading → processing → completed)
- [ ] Files visible in Supabase storage

---

## 5. 🤖 AI Training Testing

### Training Process
- [ ] Click "Start AI Training"
- [ ] Watch training steps progress:
  - [ ] Content Analysis
  - [ ] Voice Modeling
  - [ ] Personality Extraction
  - [ ] Conversation Training
  - [ ] Final Optimization
- [ ] Overall progress bar updates
- [ ] Training completes successfully
- [ ] Persona status changes to "active"

---

## 6. 💬 Conversation Testing

### Text Chat
- [ ] Select active persona → "Chat"
- [ ] Send test messages:
  - "Hello, how are you?"
  - "Tell me about your day"
  - "I miss you"
- [ ] Verify AI responses appear
- [ ] Check conversation history saves
- [ ] Test message timestamps

### Video Call Interface
- [ ] Click "Video" button
- [ ] Video call interface loads
- [ ] Controls work (mute, video toggle, end call)
- [ ] Chat overlay functions
- [ ] End call returns to dashboard

---

## 7. 📊 Analytics Testing

### Dashboard Access
- [ ] Navigate to Analytics page
- [ ] Check data displays without errors
- [ ] Verify charts and graphs load
- [ ] Test time range filters (week, month, year)

### Data Accuracy
- [ ] Conversation stats match actual usage
- [ ] Usage metrics are reasonable
- [ ] Charts display data correctly

---

## 8. 💳 Subscription Testing

### Subscription Page
- [ ] Navigate to Subscription page
- [ ] Current plan displays correctly
- [ ] Usage stats show
- [ ] Plan comparison visible

### Upgrade Flow (Don't Complete Payment)
- [ ] Click "Upgrade to Pro"
- [ ] Stripe checkout loads
- [ ] Cancel before payment
- [ ] Return to subscription page

---

## 9. 🔧 Database Setup Testing

### Database Connection
- [ ] Navigate to Database Setup page
- [ ] Connection test passes
- [ ] Database schema check passes
- [ ] All tables show as ready

---

## 10. 📱 Mobile Testing

### Responsive Design
- [ ] Resize browser to mobile size (375px width)
- [ ] Navigation menu becomes hamburger
- [ ] All pages display correctly
- [ ] Touch interactions work
- [ ] Forms are usable on mobile

### PWA Features
- [ ] Install prompt appears (if supported)
- [ ] App works offline (basic functionality)
- [ ] Service worker registers

---

## 11. 🚨 Error Handling Testing

### Invalid Operations
- [ ] Try uploading oversized files
- [ ] Submit forms with missing required fields
- [ ] Try accessing non-existent pages
- [ ] Test with network disconnected

### Error Messages
- [ ] Appropriate error messages appear
- [ ] App doesn't crash
- [ ] User can recover from errors
- [ ] Console shows no critical errors

---

## 12. 🔒 Security Testing

### Data Access
- [ ] Users only see their own personas
- [ ] Can't access other users' data
- [ ] Authentication required for protected pages
- [ ] File uploads respect size/type limits

---

## 13. ⚡ Performance Testing

### Load Times
- [ ] Initial page load < 3 seconds
- [ ] Navigation between pages is fast
- [ ] File uploads show progress
- [ ] No memory leaks during long sessions

### Network Conditions
- [ ] Test with slow network (throttle in dev tools)
- [ ] App remains usable
- [ ] Appropriate loading states

---

## 🎯 Critical Path Test (End-to-End)

Complete this full user journey:

1. [ ] Visit landing page
2. [ ] Sign up for account
3. [ ] Create first persona
4. [ ] Upload training content
5. [ ] Start AI training
6. [ ] Wait for training completion
7. [ ] Have conversation with persona
8. [ ] Check analytics
9. [ ] View subscription page
10. [ ] Sign out and sign back in

---

## ✅ Success Criteria

Your app passes testing when:
- [ ] All core features work without errors
- [ ] Database operations complete successfully
- [ ] File uploads work correctly
- [ ] User authentication is secure
- [ ] Performance is acceptable
- [ ] Mobile experience is smooth
- [ ] Error handling is graceful
- [ ] No critical console errors

---

## 🐛 Common Issues & Solutions

### "Database connection failed"
- Check environment variables in `.env`
- Verify Supabase URL and keys are correct

### "File upload fails"
- Check Supabase storage bucket exists
- Verify file size limits

### "AI responses not working"
- This is expected in local testing (simulated responses)
- Will work with real OpenAI API in production

### "Blank pages or crashes"
- Check browser console for errors
- Verify all dependencies installed
- Try refreshing the page

---

## 📝 Testing Notes

Use this space to note any issues found:

```
Issue: ________________________________
Steps to reproduce: ____________________
Expected: ______________________________
Actual: ________________________________
Severity: ______________________________
```

---

## 🚀 Ready for Deployment?

When all tests pass:
- [ ] Run `node verify-deployment.js`
- [ ] Build for production: `npm run build`
- [ ] Deploy to Netlify
- [ ] Configure environment variables
- [ ] Test deployed version

Your AlwayZ application is ready for the world! 🎉