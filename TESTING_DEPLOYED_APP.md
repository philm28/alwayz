# Testing Your Deployed AlwayZ Application

After deploying your AlwayZ application, it's important to verify that everything is working correctly. This guide will help you test all the key features.

## Basic Functionality Tests

### 1. Website Accessibility
- Visit your Netlify URL (e.g., `https://your-site-name.netlify.app`)
- Verify the landing page loads with the "Keep Their Memory Alive" tagline
- Check that all images and styles are loading correctly

### 2. User Authentication
- Click "Sign In" button
- Test registration with a new email
- Test login with the created account
- Verify you can log out and log back in

### 3. Database Connection
- Navigate to the "Database Setup" page
- Click "Test Connection"
- Verify that it shows "Connected successfully"
- If it shows "Tables need to be created", follow the migration instructions

### 4. Persona Creation
- Log in to your account
- Click "Create New Persona"
- Fill out the form with test data
- Submit the form
- Verify the persona appears in your dashboard

### 5. File Upload
- Select a persona
- Click "Setup Training"
- Upload a test image or document
- Verify the file appears in the uploaded list
- Check that the file status changes to "Complete"

### 6. AI Training Simulation
- After uploading content
- Click "Start AI Training"
- Watch the training progress
- Verify the persona status changes to "active" when complete

### 7. Conversation Testing
- Select an "active" persona
- Click "Chat"
- Send a test message
- Verify you receive a response
- Test the video call interface (if applicable)

## Advanced Testing

### 1. Environment Variables
Run this test in your browser console to check if environment variables are loaded:

```javascript
// Check if Supabase is configured
console.log(!!window.VITE_SUPABASE_URL);
```

### 2. Error Handling
- Try invalid operations (e.g., upload an oversized file)
- Verify appropriate error messages appear
- Check that the application recovers gracefully

### 3. Mobile Responsiveness
- Open the site on a mobile device or use browser dev tools to simulate one
- Verify the layout adjusts appropriately
- Test all key functions on mobile

## Automated Testing

For more comprehensive testing, you can use the included test scripts:

```bash
# Download the test script to your local machine
# Run it against your deployed site
node post-deploy-test.js https://your-site-name.netlify.app
```

## Common Issues and Solutions

### "Database connection failed"
- Check your Supabase URL and anon key in environment variables
- Verify the database migration has been run

### "File upload fails"
- Check if the storage bucket exists in Supabase
- Verify RLS policies for file uploads

### "Authentication issues"
- Check browser console for specific errors
- Verify Supabase authentication is properly configured

### "Blank pages or crashes"
- Check browser console for JavaScript errors
- Verify all environment variables are set correctly

## Final Checklist

- [ ] Landing page loads correctly
- [ ] User registration and login work
- [ ] Database connection is successful
- [ ] Persona creation works
- [ ] File uploads function correctly
- [ ] AI training simulation completes
- [ ] Conversations with personas work
- [ ] Mobile experience is smooth
- [ ] No console errors appear

If all these tests pass, your AlwayZ application is successfully deployed and ready to use!