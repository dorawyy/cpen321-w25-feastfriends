// // ============================================
// // AuthService Direct Tests - No Mocking
// // ============================================

// describe('AuthService - Direct Unit Tests (No Mocking)', () => {
//   /**
//    * Interface: AuthService class methods
//    * Mocking: None (uses real database operations)
//    * 
//    * These tests verify the AuthService methods work correctly with real database.
//    * They test business logic, data transformations, and database interactions.
//    */

//   let authService: any; // Use any to avoid importing AuthService in test

//   beforeEach(() => {
//     // Import AuthService dynamically to avoid circular dependencies
//     const { AuthService } = require('../../src/services/authService');
//     authService = new AuthService();
//   });

//   describe('generateToken()', () => {
//     test('should generate valid JWT token for user', () => {
//       /**
//        * Input: User object with _id, email, googleId
//        * Expected Output: Valid JWT string
//        * Expected Behavior:
//        *   - Generate JWT with user data
//        *   - Token should have 3 parts (header.payload.signature)
//        *   - Token should be verifiable
//        */

//       const user = {
//         _id: testUsers[0]._id,
//         email: testUsers[0].email,
//         googleId: testUsers[0].googleId,
//       };

//       const token = authService.generateToken(user);
      
//       expect(token).toBeDefined();
//       expect(typeof token).toBe('string');
//       expect(token.split('.')).toHaveLength(3);
      
//       // Verify token using jwt directly (same as middleware does)
//       const jwt = require('jsonwebtoken');
//       const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret') as any;
//       expect(decoded.userId).toBe(user._id);
//       expect(decoded.email).toBe(user.email);
//       expect(decoded.googleId).toBe(user.googleId);
//     });

//     test('should throw error when JWT_SECRET is missing', () => {
//       /**
//        * Input: User object, but JWT_SECRET env variable missing
//        * Expected Output: Error thrown
//        * Expected Behavior:
//        *   - Check if JWT_SECRET exists
//        *   - Throw configuration error
//        */

//       const originalSecret = process.env.JWT_SECRET;
//       delete process.env.JWT_SECRET;
      
//       const user = {
//         _id: testUsers[0]._id,
//         email: testUsers[0].email,
//         googleId: testUsers[0].googleId,
//       };

//       expect(() => {
//         authService.generateToken(user);
//       }).toThrow('JWT configuration error');
      
//       process.env.JWT_SECRET = originalSecret;
//     });
//   });

//   // Note: verifyToken() method removed - it was dead code (never called from controllers/middleware)
//   // The middleware uses jwt.verify directly instead of calling this service method

//   describe('findOrCreateUser()', () => {
//     // Consolidated test: find existing user and create new user
//     // This tests the findOrCreateUser method pattern
//     // The SAME method handles both scenarios: find existing -> update status, or create new
//     // Testing both scenarios covers the complete findOrCreateUser logic
//     test('should update profile picture when user has empty profile picture and Google provides one (covers authService lines 113-114)', async () => {
//     /**
//      * Covers authService.ts lines 113-114: Profile picture update condition
//      * Path: if (convertedProfilePicture && (!user.profilePicture || user.profilePicture === '')) -> update
//      * This tests the branch where user has empty profile picture and Google provides one
//      */
//     const existingUser = testUsers[0];
    
//     // Set user profile picture to empty
//     await User.findByIdAndUpdate(existingUser._id, { profilePicture: '' });
    
//     const { AuthService } = require('../../src/services/authService');
//     const axios = require('axios');
    
//     // Mock Google data with picture
//     const mockGoogleData = {
//       googleId: existingUser.googleId,
//       email: existingUser.email,
//       name: existingUser.name,
//       picture: 'https://lh3.googleusercontent.com/test-picture.jpg'
//     };
    
//     // Mock axios to return a successful image response (so conversion succeeds)
//     const mockImageBuffer = Buffer.from('fake-image-data');
//     jest.spyOn(axios, 'get').mockResolvedValueOnce({
//       data: mockImageBuffer,
//       headers: { 'content-type': 'image/jpeg' }
//     });
    
//     jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
//     const response = await request(app)
//       .post('/api/auth/signin')
//       .send({ idToken: 'mock-google-token-with-picture' });

//     jest.restoreAllMocks();
    
//     // Should successfully sign in
//     expect(response.status).toBe(200);
    
//     // Verify profile picture was updated in database (should be Base64 data URI)
//     const updatedUser = await User.findById(existingUser._id);
//     expect(updatedUser!.profilePicture).toBeTruthy();
//     expect(updatedUser!.profilePicture).not.toBe('');
//     expect(updatedUser!.profilePicture).toContain('data:image'); // Should be Base64 data URI
//   });

//   test('should update profile picture when user has undefined profile picture and Google provides one (covers authService line 112 !user.profilePicture branch)', async () => {
//     /**
//      * Covers authService.ts line 112: Profile picture update condition - !user.profilePicture branch
//      * Path: if (convertedProfilePicture && (!user.profilePicture || user.profilePicture === '')) -> update
//      * This tests the branch where user.profilePicture is undefined (not just empty string)
//      */
//     const existingUser = testUsers[1];
    
//     // Set user profile picture to undefined (unset the field)
//     await User.findByIdAndUpdate(existingUser._id, { $unset: { profilePicture: '' } });
    
//     const { AuthService } = require('../../src/services/authService');
//     const axios = require('axios');
    
//     // Mock Google data with picture
//     const mockGoogleData = {
//       googleId: existingUser.googleId,
//       email: existingUser.email,
//       name: existingUser.name,
//       picture: 'https://lh3.googleusercontent.com/test-picture-undefined.jpg'
//     };
    
//     // Mock axios to return a successful image response (so conversion succeeds)
//     const mockImageBuffer = Buffer.from('fake-image-data-for-undefined-test');
//     jest.spyOn(axios, 'get').mockResolvedValueOnce({
//       data: mockImageBuffer,
//       headers: { 'content-type': 'image/jpeg' }
//     });
    
//     jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
//     const response = await request(app)
//       .post('/api/auth/signin')
//       .set('Authorization', `Bearer ${generateTestToken(existingUser._id, existingUser.email, existingUser.googleId)}`)
//       .send({ idToken: 'mock-google-token-with-picture-undefined' });

//     jest.restoreAllMocks();
    
//     // Should successfully sign in
//     expect(response.status).toBe(200);
    
//     // Verify profile picture was updated in database (should be Base64 data URI)
//     const updatedUser = await User.findById(existingUser._id);
//     expect(updatedUser!.profilePicture).toBeTruthy();
//     expect(updatedUser!.profilePicture).not.toBe('');
//     expect(updatedUser!.profilePicture).toContain('data:image'); // Should be Base64 data URI
//   });

//   test('should skip profile picture conversion when googleData.picture is missing (covers authService line 89 else branch)', async () => {
//     /**
//      * Covers authService.ts line 89: else branch when googleData.picture is falsy
//      * Path: if (googleData.picture) [FALSE] -> skip conversion, convertedProfilePicture remains ''
//      * This tests the branch where Google doesn't provide a picture
//      */
//     const existingUser = testUsers[2];
    
//     // Set user profile picture to empty first
//     await User.findByIdAndUpdate(existingUser._id, { profilePicture: '' });
    
//     const { AuthService } = require('../../src/services/authService');
    
//     // Mock Google data WITHOUT picture (undefined/missing)
//     const mockGoogleData = {
//       googleId: existingUser.googleId,
//       email: existingUser.email,
//       name: existingUser.name
//       // picture is missing/undefined
//     };
    
//     jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
//     const response = await request(app)
//       .post('/api/auth/signin')
//       .set('Authorization', `Bearer ${generateTestToken(existingUser._id, existingUser.email, existingUser.googleId)}`)
//       .send({ idToken: 'mock-google-token-no-picture' });

//     jest.restoreAllMocks();
    
//     // Should successfully sign in
//     expect(response.status).toBe(200);
    
//     // Verify profile picture was NOT updated (should remain empty since no picture was provided)
//     const updatedUser = await User.findById(existingUser._id);
//     expect(updatedUser!.profilePicture).toBe(''); // Should remain empty
//   });

//   test('should keep existing profile picture when user has one and Google provides picture (covers authService line 115)', async () => {
//     /**
//      * Covers authService.ts line 115: else if branch when user has existing profile picture
//      * Path: else if (user.profilePicture && user.profilePicture !== '') -> keep existing, don't update
//      * This tests the branch where user already has a custom profile picture and we keep it
//      */
//     const existingUser = testUsers[3];
    
//     // Set user profile picture to a custom value
//     const customProfilePicture = 'https://example.com/custom-picture.jpg';
//     await User.findByIdAndUpdate(existingUser._id, { profilePicture: customProfilePicture });
    
//     const { AuthService } = require('../../src/services/authService');
//     const axios = require('axios');
    
//     // Mock Google data WITH picture
//     const mockGoogleData = {
//       googleId: existingUser.googleId,
//       email: existingUser.email,
//       name: existingUser.name,
//       picture: 'https://lh3.googleusercontent.com/google-picture.jpg'
//     };
    
//     // Mock axios (even though it won't be called since we keep existing picture)
//     const mockImageBuffer = Buffer.from('fake-image-data');
//     jest.spyOn(axios, 'get').mockResolvedValueOnce({
//       data: mockImageBuffer,
//       headers: { 'content-type': 'image/jpeg' }
//     });
    
//     jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
//     const response = await request(app)
//       .post('/api/auth/signin')
//       .set('Authorization', `Bearer ${generateTestToken(existingUser._id, existingUser.email, existingUser.googleId)}`)
//       .send({ idToken: 'mock-google-token-with-picture-existing' });

//     jest.restoreAllMocks();
    
//     // Should successfully sign in
//     expect(response.status).toBe(200);
    
//     // Verify profile picture was NOT updated (should keep the custom one)
//     const updatedUser = await User.findById(existingUser._id);
//     expect(updatedUser!.profilePicture).toBe(customProfilePicture); // Should keep existing custom picture
//     expect(updatedUser!.profilePicture).not.toContain('data:image'); // Should NOT be converted to Base64
//   });

//   test('should find existing user and update status, or create new user when not found', async () => {
//       /**
//        * Tests findOrCreateUser method pattern
//        * Covers: authService.findOrCreateUser (find existing and create new)
//        * Both scenarios execute the same method with different outcomes
//        */
//       // Test 1: Find existing user and update status
//       const existingUser = testUsers[0];
      
//       // Set user to OFFLINE first
//       await User.findByIdAndUpdate(existingUser._id, { status: UserStatus.OFFLINE });

//       const googleDataExisting = {
//         googleId: existingUser.googleId,
//         email: existingUser.email,
//         name: existingUser.name,
//         picture: 'https://example.com/picture.jpg'
//       };
      
//       const userExisting = await authService.findOrCreateUser(googleDataExisting);
      
//       expect(userExisting).toBeDefined();
//       expect(userExisting._id.toString()).toBe(existingUser._id);
//       expect(userExisting.status).toBe(UserStatus.ONLINE);
      
//       // Verify database was updated
//       const updatedUser = await User.findById(existingUser._id);
//       expect(updatedUser!.status).toBe(UserStatus.ONLINE);
      
//       // Test 2: Create new user when not found
//       const googleDataNew = {
//         googleId: `new-google-id-${Date.now()}`,
//         email: `newuser-${Date.now()}@example.com`,
//         name: 'New User',
//         picture: 'https://example.com/new-picture.jpg'
//       };
      
//       // Ensure user doesn't exist
//       await User.deleteOne({ googleId: googleDataNew.googleId });
      
//       const userNew = await authService.findOrCreateUser(googleDataNew);
      
//       expect(userNew).toBeDefined();
//       expect(userNew.googleId).toBe(googleDataNew.googleId);
//       expect(userNew.email).toBe(googleDataNew.email);
//       expect(userNew.status).toBe(UserStatus.ONLINE);
//       expect(userNew.credibilityScore).toBe(100);
      
//       // Clean up
//       await User.deleteOne({ _id: userNew._id });
//     });

//     test('should return original URL when profile picture is not a Google URL', async () => {
//       /**
//        * Covers authService.ts lines 19-20: convertGoogleProfilePictureToBase64 early return
//        * Path: if (!profilePictureUrl || !profilePictureUrl.startsWith(...)) [TRUE BRANCH] -> return profilePictureUrl
//        * This tests the convertGoogleProfilePictureToBase64 method indirectly through findOrCreateUser
//        */
//       const googleData = {
//         googleId: `test-google-id-${Date.now()}`,
//         email: `test-${Date.now()}@example.com`,
//         name: 'Test User',
//         picture: 'https://example.com/picture.jpg' // Not a Google URL
//       };
      
//       // Ensure user doesn't exist
//       await User.deleteOne({ googleId: googleData.googleId });
      
//       const user = await authService.findOrCreateUser(googleData);
      
//       // Profile picture should be the original URL (not converted to Base64)
//       expect(user.profilePicture).toBe(googleData.picture);
      
//       // Clean up
//       await User.deleteOne({ googleId: googleData.googleId });
//     });

//     test('should handle profile picture conversion failure gracefully', async () => {
//       /**
//        * Covers authService.ts lines 38-40: convertGoogleProfilePictureToBase64 catch block
//        * Path: axios.get throws error -> catch -> return profilePictureUrl
//        * This tests error handling in convertGoogleProfilePictureToBase64
//        */
//       const axios = require('axios');
//       const originalGet = axios.get;
      
//       // Mock axios.get to throw an error
//       axios.get = jest.fn().mockRejectedValue(new Error('Network error'));
      
//       const googleData = {
//         googleId: `test-google-id-${Date.now()}`,
//         email: `test-${Date.now()}@example.com`,
//         name: 'Test User',
//         picture: 'https://lh3.googleusercontent.com/test-picture' // Google URL that will fail
//       };
      
//       // Ensure user doesn't exist
//       await User.deleteOne({ googleId: googleData.googleId });
      
//       const user = await authService.findOrCreateUser(googleData);
      
//       // Should return original URL when conversion fails
//       expect(user.profilePicture).toBe(googleData.picture);
      
//       // Restore axios.get
//       axios.get = originalGet;
      
//       // Clean up
//       await User.deleteOne({ googleId: googleData.googleId });
//     });

//     test('should use image/png fallback when content-type header is missing', async () => {
//       /**
//        * Covers authService.ts line 32: convertGoogleProfilePictureToBase64 content-type fallback
//        * Path: response.headers['content-type'] || 'image/png' [FALSE BRANCH] -> use 'image/png'
//        * This tests the fallback when content-type header is missing
//        */
//       const axios = require('axios');
//       const originalGet = axios.get;
      
//       // Mock axios.get to return response without content-type header
//       const mockBuffer = Buffer.from('fake-image-data');
//       axios.get = jest.fn().mockResolvedValue({
//         data: mockBuffer,
//         headers: {} // No content-type header
//       });
      
//       const googleData = {
//         googleId: `test-google-id-${Date.now()}`,
//         email: `test-${Date.now()}@example.com`,
//         name: 'Test User',
//         picture: 'https://lh3.googleusercontent.com/test-picture'
//       };
      
//       // Ensure user doesn't exist
//       await User.deleteOne({ googleId: googleData.googleId });
      
//       const user = await authService.findOrCreateUser(googleData);
      
//       // Should use 'image/png' as fallback when content-type is missing
//       expect(user.profilePicture).toContain('data:image/png;base64,');
      
//       // Restore axios.get
//       axios.get = originalGet;
      
//       // Clean up
//       await User.deleteOne({ googleId: googleData.googleId });
//     });
//   });

//   describe('verifyGoogleToken()', () => {
//     test('should throw AppError when payload is invalid', async () => {
//       /**
//        * Covers authService.ts lines 61-62: verifyGoogleToken validation check
//        * Path: if (!payload || !payload.sub || !payload.email) [TRUE BRANCH] -> throw AppError
//        * This requires mocking the Google OAuth client
//        */
//       const { OAuth2Client } = require('google-auth-library');
//       const mockTicket = {
//         getPayload: jest.fn().mockReturnValue({
//           // Missing sub or email
//           name: 'Test User'
//         })
//       };
      
//       const mockGoogleClient = {
//         verifyIdToken: jest.fn().mockResolvedValue(mockTicket)
//       };
      
//       // Mock the OAuth2Client constructor
//       jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(mockGoogleClient.verifyIdToken);
      
//       // The validation error gets caught by the catch block and re-thrown
//       // So we expect the catch block's error message
//       await expect(
//         authService.verifyGoogleToken('mock-token')
//       ).rejects.toThrow('Failed to verify Google token');
      
//       jest.restoreAllMocks();
//     });

//     test('should use "User" as fallback when name is missing', async () => {
//       /**
//        * Covers authService.ts line 68: verifyGoogleToken name fallback
//        * Path: name: payload.name || 'User' [FALSE BRANCH] -> use 'User'
//        * This requires mocking the Google OAuth client
//        */
//       const { OAuth2Client } = require('google-auth-library');
//       const mockTicket = {
//         getPayload: jest.fn().mockReturnValue({
//           sub: 'google-id-123',
//           email: 'test@example.com',
//           // name is missing
//         })
//       };
      
//       const mockGoogleClient = {
//         verifyIdToken: jest.fn().mockResolvedValue(mockTicket)
//       };
      
//       // Mock the OAuth2Client constructor
//       jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(mockGoogleClient.verifyIdToken);
      
//       const result = await authService.verifyGoogleToken('mock-token');
      
//       expect(result.name).toBe('User');
//       expect(result.googleId).toBe('google-id-123');
//       expect(result.email).toBe('test@example.com');
      
//       jest.restoreAllMocks();
//     });

//     test('should throw AppError in catch block when verification fails', async () => {
//       /**
//        * Covers authService.ts lines 71-73: verifyGoogleToken catch block
//        * Path: verifyIdToken throws -> catch -> throw AppError
//        */
//       const { OAuth2Client } = require('google-auth-library');
      
//       // Mock verifyIdToken to throw an error
//       jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockRejectedValue(new Error('Token verification failed'));
      
//       await expect(
//         authService.verifyGoogleToken('invalid-token')
//       ).rejects.toThrow('Failed to verify Google token');
      
//       jest.restoreAllMocks();
//     });
//   });

//   describe('logoutUser()', () => {
//     test('should set user status to OFFLINE', async () => {
//       /**
//        * Input: User ID
//        * Expected Output: User status updated to OFFLINE
//        * Expected Behavior:
//        *   - Find user by ID in database
//        *   - Update status to OFFLINE
//        *   - Save to database
//        */

//       const user = testUsers[0];
      
//       // Set user to ONLINE first
//       await User.findByIdAndUpdate(user._id, { status: UserStatus.ONLINE });
      
//       await authService.logoutUser(user._id);
      
//       // Verify database was updated
//       const updatedUser = await User.findById(user._id);
//       expect(updatedUser!.status).toBe(UserStatus.OFFLINE);
//     });

//     test('should handle non-existent user gracefully', async () => {
//       /**
//        * Input: Non-existent user ID
//        * Expected Output: No error thrown
//        * Expected Behavior:
//        *   - Try to find user
//        *   - User doesn't exist
//        *   - Handle gracefully without throwing error
//        */

//       const nonExistentId = '507f1f77bcf86cd799439011';
      
//       await expect(authService.logoutUser(nonExistentId)).resolves.not.toThrow();
//     });
//   });

//   // Note: "should update FCM token for user" and "should throw error when user not found" tests are consolidated above
//   // The same updateFCMToken logic is covered by endpoint tests in "should return 200 and update FCM token successfully"
//   // and "should return 404 when user not found" (which covers the user not found error case)

//   // Note: deleteAccount() and updateFCMToken() methods removed - they were dead code
//   // Controllers implement the logic directly instead of calling these service methods
// });