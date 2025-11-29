## **Part I – Refined Project Requirements and Complete Design**

### **1\. Change History**

| Date | Section Changed | Rationale |
| ----- | ----- | ----- |
| 2025-11-28 | Updated Use Case Diagram | Updated Use Case diagram to match our newly added features |
| 2025-11-07 | Formal Use Case Spec | Use Case Spec changed to match implementation and testing spec |
| 2025-10-26 | Use Case Diagram | Fixed errors related to scope of use cases |
| 2025-10-26 | Description of Use Cases | Fixed naming inconsistency and details related to implementation |
| 2025-10-26 | Non-Functional Requirements | Previous requirements were incorrect and not aligned with our app |
| 2025-11-27 | Non-Functional Requirements | Updated the specifications for the NFRs to be more precise  |
| 2025-11-28 | Use-case Diagram  | Updated to be more precise on our updated specific use cases  |
| 2025-11-28 | Use cases  | Updated credibility use case  |
| 2025-11-28 | Credibility Database Model | Updated credibility service  |

---

### **2\. Project Description**

In today’s social media driven world, many people may struggle with spontaneity and meeting new people, especially in unfamiliar environments. Whether it’s the anxiety of stepping outside one's comfort zone or the uncertainty in planning social events, socializing may feel stressful. Our goal is to help address this issue. Through providing simple and quick restaurant recommendations without preplanning, this app promotes a stress-free way of connecting with others and exploring new places.

Through quick, personalized recommendations for restaurants based on user preferences, the app offers real-time suggestions and forms groups based on user choices. This project would encourage users to step outside their comfort zone and be more spontaneous in the hopes of bringing together diverse people.

The app targets a wide range of audiences such as people who are new to the city and may not know anyone or places to have fun, locals who are looking to break out of their routine and try something fun, or individuals looking for a nice break from their daily schedule to try out a new restaurant. Through encouraging people to explore new restaurants and strengthen their social circle, this app brings together a meaningful community.  
---

## **3\. Requirements Specification**

### **3.1 Project Features**

Features: 

1. **Authentication**: New users must sign up using Google Authentication service before using the application. To participate in main app features, the user must be signed in beforehand using Google sign-in. Users also have the option to sign out or remove their account.  
2. **Profile Management:** The user has the option to select a profile photo and fill in a short bio. The user must select their restaurant preferences, including maximum budget, maximum location (ex: within 10 km) and preferred types of cuisine. Preferences are not visible to other users and only used for internal matching logic.   
3. **Find Matches:** When the user is interested in attending a restaurant with a group, they should hit a button to trigger the app to use their current location and preferences to place them in a “waiting room”. The waiting room stays open for 10 minutes, while other matched users can also be placed in the room. If a user closes the app while being in a waiting room then rejoins the application, they will automatically be redirected to the waiting room screen to see who else has joined. They have the option to leave the room if they are no longer interested.   
4. **Group-based Voting:** Matched users will be placed in a group together and shown a restaurant option with a Yes or No button. If the majority of group members vote Yes, that restaurant is selected and all location information is shown in the group, along with the meeting time.  
5. **Credibility Score:** All users have a 100% rating which is visible to other users. When attending an event, users must “check-in” on the app to confirm that they attended. If a user joins a group and does not attend the event, they lose points and their rating will drop. The credibility score affects how the user is given priority during matching.

---

### **3.2 Use Case Diagram**

*![][image1]*

---

### **3.3 Actors**

* User: The main participant who interacts with the app to log in, set preferences, find matches, join group chats, and attend events.

* Google Authentication Service: External service used for secure sign-in and account verification.

* Google Maps API: External service that provides restaurant data, locations, and distance calculations.

* Notification Service: External service (e.g., Firebase) that sends real-time alerts for matches, waiting room updates, polls, and check-ins.

---

### **3.4 Use Cases by Feature**

Features: 

Authentication

* **Sign Up**: The user signs up with Google authentication to create an account to access the app.  
* **Sign In:** The user signs in to access the app.  
* **Sign Out**: The user signs out when done.  
* **Delete Account**: The user deletes their account, and the system removes their data.

Profile Creation

* **Set Preferences**: The user specifies cuisine, budget, and distance preferences for matchmaking.  
* **Update Profile**: The user can add a bio, phone number and profile picture to their profile. The phone number will become visible to matched users only. The user can go back and edit their profile after initial profile creation.

Match with Other Users

* **Request Match**: The user presses the “Find match”  button or shakes their phone to trigger the matchmaking function. The system then places the user in a “Waiting Room” while matchmaking takes place to find a group of compatible users.   
  * The waiting room stays open for 10 minutes, while other matched users can also be placed in the room. A minimum of 4 members and maximum of 10 are required to form a matched “group”.   
  * If the 10 minute time-limit is reached and a minimum of 4 members are not placed in the waiting room, all users are notified that a group could not be formed at this time and they should try again later.   
  * The waiting room screen exits and moves to the next screen (Group Voting) when either 10 members have joined the waiting room or 10 minutes have been reached with at least 4 members.  
* **Exit Waiting Room**: The user may cancel and leave the waiting room at any time.  
* **Automatically Rejoin Waiting room:** The user may automatically re-enter a waiting room by opening the app.

Group- Based Voting

* **Vote on Restaurant Option**: Users are presented with restaurant options, which they can vote Yes/No. Each restaurant option card shows an image of the restaurant interior, a short description of the type of cuisine, and the approximate commute time to the location. When the majority of users vote Yes, the restaurant is selected.  
* **View Selected Restaurant:** Users view the final selected restaurant and are provided additional details. They are able to see information such as the address, Google review, restaurant phone number, website and level of occupancy.  
* **Leave Group**: Users can exit the group or request a new match.  
* **Rejoin Group Automatically:** The user can rejoin the group automatically if they leave the group screen or restaurant voting screen.  
* **Automatically Create Group From Waiting Room:** Creates a group from the waiting room after there are enough members in the room and the timer reaches zero.

Credibility Score

* **Check in Group Member with Code**: When a user registers for the application, they are given a score of 100%. Once a restaurant has been found other users can check each other in. If a user is not checked in their score decreases by 10%, else it increases by 5%. During the matching phase, priority is given for users with higher credibility scores to join waiting rooms. 

Other Use Cases

* **Receive Notifications:** Users will receive push notifications when the matching process has been completed, a waiting room has expired, and when voting has completed.   
* **View Group Member Profile:** Users can view basic profile information such as name, bio, phone number etc. of other users who are in the same group.

---

### **3.5 Formal Use Case Specifications (central use cases, exclude authentication)**

*General Extensions, Not Use case specific*  

- Generic wifi failure \[overwritten by specific wifi failures\]   
  - Error message is contained,   
    - If 4\*\* error display code,   
    - If 5\*\* display internal server error  
  - User is prompted to check their network connection and wait a set time period before trying again

*Profile Creation*

### Title: Set Preferences

**Description:**  
The user can set their dining preferences, spending limit, and search radius to personalize matchmaking results.

**Primary Actor:**  
 Base User

**Preconditions:**  
 User is logged in and has accessed the *ProfileConfigScreen*.

**Postconditions:**  
 User’s preferences (food types, spending limit, and radius) are stored in the database.

**Main Success Scenarios:**

1. User is on *ProfileConfigScreen* and clicks “Preferences”.

2. User is brought to *PreferencesScreen*.

3. User selects 0 or more preferences.

4. User drags “Max amount of money to spend” slider to a desired amount.

5. User drags “Search radius” slider to a desired distance.

6. User clicks “Save Preferences” to store preferences successfully.

Extensions:  
 7a. Internet connection error  
  – Screen is waiting for response; user is prompted to try again later.

### Title: Add Profile Information

**Description:**  
User enters personal information such as name, bio, and phone number to complete their profile.

**Primary Actor:**  
 Base User

**Preconditions:**  
 User is logged in and has access to the profile configuration screen.

**Postconditions:**  
 User’s profile information is stored in the database.

Main Success Scenarios:

1. User clicks “Profile” on *ProfileConfigScreen*.

2. User is brought to *ProfileScreen*.

3. User types name in “Name” field.

4. User types bio in “Bio” field.

5. User types phone number in “Phone Number” field.

6. User presses “Save Profile”.

Extensions:  
 6a. Phone number entered is less than 10 digits  
  – App displays “Phone number must be at least 10 digits.”  
  – User is prompted to enter again.  
 8a. Internet connection error  
  – Screen is waiting for response; user is prompted to try again later.

### Title: Update Profile Information

**Description:**  
 User can update profile picture, name, bio, or phone number as needed.

**Primary Actor:**  
 Base User

**Preconditions:**  
 User has an existing account and profile data.

**Postconditions**:  
 Profile information is updated and persisted.

**Main Success Scenarios:**

1. User clicks “Profile” on *ProfileConfigScreen*.

2. User is brought to *ProfileScreen*.

3. User clicks “Change Profile Picture” to select a new image.

4. User updates name, bio, or phone number.

5. User presses “Save Profile”.

6. Screen refreshes with message “Settings updated successfully”.

Extensions:  
 6a. Invalid phone number  
  – App displays “Phone number must be at least 10 digits.”  
  – User must re-enter a valid number.  
 8a. Internet connection error  
  – Screen is waiting for response; user is prompted to try again later.

*Find Matches / Waiting Room*

### Title: Request Matches (Join Waiting Room)

**Description:**  
 User requests to find a group by joining a waiting room for matchmaking.

**Primary Actor:**  
 Base User

**Preconditions:**  
 The user is logged in and has completed setting preferences.

**Postconditions:**  
 The user is added to a waiting room; matchmaking begins.

**Main Success Scenarios:**

1. User is on the Home Screen and clicks “Start Matchmaking”.

2. User enters the waiting room screen showing current participants and timer.

3. Once enough users have joined or timer ends, user is automatically taken to the group screen.

**Extensions:**  
 1a. **User has not set preferences**  
  – User is redirected to *PreferencesScreen* to set preferences.  
  – After saving, user returns to *HomeScreen* to restart matchmaking.  
 2a. **Internet connection error**  
  – Screen waits for response; user is prompted to try again later.  
 3a. **Not enough users joined**  
  – Timer expires; user can restart matchmaking manually.

---

### Title: Exit Waiting Room

**Description:**  
 User leaves the waiting room before matchmaking completes.

**Primary Actor:**  
 Base User

**Preconditions:**  
 User is currently inside the waiting room screen.

**Postconditions:**  
 User is removed from the waiting room and returned to the home screen.

**Main Success Scenarios:**

1. User clicks “Leave Room”.

2. App displays confirmation dialog with “Stay” and “Leave”.

3. User confirms “Leave”; app exits waiting room.

**Extensions:**  
 3a. **User selects “Stay”**  
  – User remains in waiting room.  
 3b. **Internet connection error**  
  – Screen waits for response; user is prompted to try again later.

---

### Title: Rejoin Waiting Room

**Description:**  
 User rejoins matchmaking after leaving a previous session.

**Primary Actor:**  
 Base User

**Preconditions:**  
 User has previously left a waiting room.

**Postconditions:**  
 User is re-added to matchmaking queue.

**Main Success Scenarios:**

1. User is on Home Screen.

2. User clicks “Start Matchmaking” again.

3. User re-enters the waiting room and waiting room screen appears.

**Extensions:**  
 3a. **Internet connection error**  
  – Screen waits for response; user is prompted to try again later.

*Group-Based Voting*

### Title: Vote on Restaurant

**Description:**  
 Users in a group vote on available restaurants to decide where to go.

**Primary Actor:**  
 Base User

**Preconditions:**  
 User is logged in and assigned to a group.

**Postconditions:**  
 User’s vote is recorded and aggregated with other members’ votes.

Main Success Scenarios:

1. User is taken to *VoteRestaurantScreen*.

2. User selects a restaurant from list and taps “Vote”.

3. App confirms submission (“Vote cast successfully”).

4. User waits for others to finish voting.

Extensions:  
 1a. Location permission not granted  
  – App displays “Grant Location Permission” prompt.  
  – User must enable location in settings and retry.  
 1b. Internet connection error  
  – Screen waits for response; user is prompted to try again later.

---

### Title: View Restaurant Choice

**Description:**  
 After all votes are submitted, user can view the final chosen restaurant.

**Primary Actor:**  
 Base User

**Preconditions:**  
 Voting phase is completed.

**Postconditions:**  
 User views the final restaurant and associated information.

**Main Success Scenarios:**

1. User opens *View Active Group*.

2. App displays “Voting Complete”.

3. Restaurant name and address are shown.

4. User can return to Home Screen.

Extensions:  
 1a. Internet connection error  
  – Screen waits for response; user is prompted to try again later.

### Title: View Group History

**Description:**  
 User can view their active or past groups and see related details.

**Primary Actor:**  
 Base User

**Preconditions:**  
 User is logged in.

**Postconditions:**  
 Group details or “No active group” message displayed.

**Main Success Scenarios:**

1. User presses “View Active Group” from *HomeScreen*.

2. If user is in a group, details appear (restaurant, members).

3. If not, “You are not in a group” message appears.

4. User returns to *HomeScreen* by tapping “Go Back”.

Extensions:  
 3a. Internet connection error  
  – Screen waits for response; user is prompted to try again later.

### Title: View Group Details

**Description**:  
 User can view restaurant and member details for a completed group.

**Primary Actor:**  
 Base User

**Preconditions**:  
 Group voting is complete and a restaurant has been selected.

**Postconditions:**  
 Restaurant and member details are displayed.

**Main Success Scenarios:**

1. User is on *ViewGroupsScreen*.

2. User taps “View Details”.

3. *GroupScreen* opens with restaurant info and member list.

4. User clicks “Back to View Groups”.

Extensions:  
 1a. No completed group available  
  – App shows “No completed group available for details view.”  
 1b. Internet connection error  
  – Screen waits for response; user is prompted to try again later.

### Title: Leave / Rematch

**Description:**  
 User can leave their current group and return to matchmaking.

**Primary Actor:**  
 Base User

**Preconditions:**  
 User is currently in a group.

**Postconditions:**  
 User leaves group and is returned to Home Screen.

Main Success Scenarios:

1. User presses “Leave Group”.

2. Confirmation dialog appears (“Stay” or “Leave”).

3. User selects “Leave”; app exits group and returns to Home Screen.

4. User may press “Start Matchmaking” to rematch.

Extensions:  
 4a. User selects “Stay”  
  – User remains in the group.  
 4b. Internet connection error  
  – Screen waits for response; user is prompted to try again later.

---

### **4\. Design Specification**

#### **4.1 Component Interfaces**

\[for reference\]  
![][image2]

*(List backend interfaces in Java-style signatures and frontend ↔ backend in REST-style)*

**Backend Interfaces**

# Component Interfaces Documentation

## Backend Component Interactions (Java-style Method Signatures)

---

## **1\. Authentication Service Interface**

**Purpose:** Handles Google OAuth verification, JWT token management, and user authentication lifecycle.

### **Methods:**

GoogleData verifyGoogleToken(String idToken)

* **Parameters:** `idToken` \- Google OAuth ID token from client  
* **Returns:** GoogleData object containing googleId, email, name, picture  
* **Description:** Verifies Google ID token with Google Auth Library and extracts user information for authentication.

User findOrCreateUser(GoogleData googleData)

* **Parameters:** `googleData` \- User information from Google authentication  
* **Returns:** User document from database  
* **Description:** Finds existing user by googleId or creates new user account; converts Google profile picture URL to Base64 format for storage.

String generateToken(User user)

* **Parameters:** `user` \- User document containing userId, email, googleId  
* **Returns:** JWT token string (valid for 7 days)  
* **Description:** Generates signed JWT token for authenticated user sessions using JWT\_SECRET.

TokenPayload verifyToken(String token)

* **Parameters:** `token` \- JWT authentication token  
* **Returns:** TokenPayload containing userId, email, googleId  
* **Description:** Validates JWT token signature and expiration; throws error if invalid.

void logoutUser(String userId)

* **Parameters:** `userId` \- User's unique identifier  
* **Returns:** void  
* **Description:** Sets user status to OFFLINE in database.

void updateFCMToken(String userId, String fcmToken)

* **Parameters:** `userId` \- User's unique identifier, `fcmToken` \- Firebase Cloud Messaging device token  
* **Returns:** void  
* **Description:** Updates user's FCM token for push notifications.

void deleteAccount(String userId)

* **Parameters:** `userId` \- User's unique identifier  
* **Returns:** void  
* **Description:** Deletes user account from system; throws error if user is in active room or group.

---

## **2\. User Service Interface**

**Purpose:** Manages user profiles, preferences, and settings.

### **Methods:**

List\<UserProfile\> getUserProfiles(List\<String\> userIds)

* **Parameters:** `userIds` \- List of user unique identifiers  
* **Returns:** List of UserProfile objects containing userId, name, bio, profilePicture, contactNumber  
* **Description:** Batch retrieves user profiles for displaying group member information.

UserSettings getUserSettings(String userId)

* **Parameters:** `userId` \- User's unique identifier  
* **Returns:** UserSettings object with all user data including preferences, credibilityScore, budget, radiusKm, status, roomID, groupID  
* **Description:** Retrieves complete user settings for profile/settings screens.

UserProfile createUserProfile(String userId, ProfileData data)

* **Parameters:** `userId` \- User's unique identifier, `data` \- Profile fields (name, bio, profilePicture, contactNumber)  
* **Returns:** Updated UserProfile object  
* **Description:** Creates or updates user profile information during onboarding.

UserSettings updateUserSettings(String userId, SettingsData data)

* **Parameters:** `userId` \- User's unique identifier, `data` \- Settings fields (name, bio, preference, profilePicture, contactNumber, budget, radiusKm)  
* **Returns:** Updated UserSettings object  
* **Description:** Updates user preferences and matching constraints; converts Google profile picture URLs to Base64.

UserProfile updateUserProfile(String userId, ProfileData data)

* **Parameters:** `userId` \- User's unique identifier, `data` \- Profile fields to update  
* **Returns:** Updated UserProfile object  
* **Description:** Updates user profile with new information; converts Google profile pictures to Base64.

DeleteResult deleteUser(String userId)

* **Parameters:** `userId` \- User's unique identifier  
* **Returns:** DeleteResult object with `deleted: true`  
* **Description:** Deletes user account; throws error if user in active room/group.

---

## **3\. Matching Service Interface**

**Purpose:** Handles room creation, matching algorithm, and group formation.

**Constants:**

* `ROOM_DURATION_MS = 2 minutes`  
* `MAX_MEMBERS = 10`  
* `MIN_MEMBERS = 2`  
* `MINIMUM_MATCH_SCORE = 30`  
* `VOTING_TIME = 30 minutes`

### **Methods:**

JoinMatchingResult joinMatching(String userId, MatchingCriteria criteria)

* **Parameters:** `userId` \- User's unique identifier, `criteria` \- Object containing cuisine\[\], budget, radiusKm  
* **Returns:** JoinMatchingResult object with roomId and room data  
* **Description:** Finds compatible room using scoring algorithm (cuisine: 50pts, budget: 30pts, radius: 20pts) or creates new room; automatically forms group when room reaches 10 members; emits real-time updates via Socket.IO.

void leaveRoom(String userId, String roomId)

* **Parameters:** `userId` \- User's unique identifier, `roomId` \- Room's unique identifier  
* **Returns:** void  
* **Description:** Removes user from waiting room; deletes room if empty, otherwise updates room averages and notifies remaining members via Socket.IO.

RoomStatus getRoomStatus(String roomId)

* **Parameters:** `roomId` \- Room's unique identifier  
* **Returns:** RoomStatus object with roomID, completionTime, members\[\], groupReady, status  
* **Description:** Retrieves current room state for countdown timer and member list display.

List\<String\> getRoomUsers(String roomId)

* **Parameters:** `roomId` \- Room's unique identifier  
* **Returns:** List of user IDs in the room  
* **Description:** Gets list of users currently in waiting room.

void checkExpiredRooms()

* **Parameters:** None  
* **Returns:** void  
* **Description:** Background task that checks for expired rooms; forms group if \>= 2 members, otherwise expires room and notifies users.

void createGroupFromRoom(String roomId)

* **Parameters:** `roomId` \- Room's unique identifier  
* **Returns:** void  
* **Description:** Internal method that converts full/expired room into group, updates user statuses, and sends notifications.

---

## **4\. Group Service Interface**

**Purpose:** Manages groups, restaurant voting, and group lifecycle.

### **Methods:**

GroupStatus getGroupStatus(String groupId)

* **Parameters:** `groupId` \- Group's unique identifier  
* **Returns:** GroupStatus object with groupId, roomId, completionTime, numMembers, users\[\], restaurantSelected, restaurant, status  
* **Description:** Retrieves current group state including voting progress and selected restaurant.

VoteResult voteForRestaurant(String userId, String groupId, String restaurantId, Restaurant restaurant)

* **Parameters:** `userId` \- User's unique identifier, `groupId` \- Group's unique identifier, `restaurantId` \- Restaurant's unique identifier, `restaurant` \- Optional restaurant details  
* **Returns:** VoteResult object with message and Current\_votes map  
* **Description:** Records user's vote; automatically selects restaurant when all members vote; emits real-time vote updates via Socket.IO; sends push notifications when restaurant selected.

void leaveGroup(String userId, String groupId)

* **Parameters:** `userId` \- User's unique identifier, `groupId` \- Group's unique identifier  
* **Returns:** void  
* **Description:** Removes user from group; deletes group if empty; auto-selects restaurant if remaining members all voted; notifies remaining members via Socket.IO.

Group getGroupByUserId(String userId)

* **Parameters:** `userId` \- User's unique identifier  
* **Returns:** Group object or null if not in group  
* **Description:** Finds active group that user is currently part of.

void closeGroup(String groupId)

* **Parameters:** `groupId` \- Group's unique identifier  
* **Returns:** void  
* **Description:** Closes/disbands group and updates all member statuses to ONLINE; used after restaurant visit or manual closure.

void checkExpiredGroups()

* **Parameters:** None  
* **Returns:** void  
* **Description:** Background task that checks for expired groups; auto-selects restaurant with most votes or disbands if no votes; sends notifications.

---

## **5\. Restaurant Service Interface**

**Purpose:** Integrates with Google Places API for restaurant search and recommendations.

### **Methods:**

List\<Restaurant\> searchRestaurants(double latitude, double longitude, int radius, List\<String\> cuisineTypes, int priceLevel)

* **Parameters:** `latitude` \- Location latitude, `longitude` \- Location longitude, `radius` \- Search radius in meters (default 5000), `cuisineTypes` \- Optional cuisine keywords, `priceLevel` \- Optional price filter (1-4)  
* **Returns:** List of Restaurant objects  
* **Description:** Searches Google Places API for restaurants matching criteria; falls back to mock data if no API key configured.

Restaurant getRestaurantDetails(String placeId)

* **Parameters:** `placeId` \- Google Places API place\_id  
* **Returns:** Restaurant object with detailed information  
* **Description:** Fetches detailed restaurant information including photos, hours, contact from Google Places API.

List\<Restaurant\> getRecommendationsForGroup(String groupId, List\<UserPreferences\> userPreferences)

* **Parameters:** `groupId` \- Group's unique identifier, `userPreferences` \- Array of individual user preferences  
* **Returns:** List of recommended Restaurant objects  
* **Description:** Calculates average location, combines cuisine preferences, averages budget/radius; searches for restaurants matching aggregated preferences.

---

## **6\. Credibility Service Interface**

**Purpose:** Manages user credibility scores based on participation and behavior.

**Score Changes:**

* `NO_SHOW: -15`  
* `LATE_CANCEL: -10`  
* `LEFT_GROUP_EARLY: -5`  
* `COMPLETED_MEETUP: +5`  
* `POSITIVE_REVIEW: +3`  
* `NEGATIVE_REVIEW: -8`

### **Methods:**

CredibilityChange updateCredibilityScore(String userId, CredibilityAction action, String groupId, String roomId, String notes)

* **Parameters:** `userId` \- User's unique identifier, `action` \- Type of action (enum), `groupId` \- Optional group context, `roomId` \- Optional room context, `notes` \- Optional description  
* **Returns:** CredibilityChange object with previousScore, newScore, scoreChange  
* **Description:** Updates user's credibility score (clamped 0-100) and logs the change with timestamp.

void recordCompletedMeetup(String userId, String groupId)

* **Parameters:** `userId` \- User's unique identifier, `groupId` \- Group's unique identifier  
* **Returns:** void  
* **Description:** Records successful meetup attendance (+5 credibility).

void recordNoShow(String userId, String groupId)

* **Parameters:** `userId` \- User's unique identifier, `groupId` \- Group's unique identifier  
* **Returns:** void  
* **Description:** Records user no-show at restaurant (-15 credibility).

void recordLeftGroupEarly(String userId, String groupId)

* **Parameters:** `userId` \- User's unique identifier, `groupId` \- Group's unique identifier  
* **Returns:** void  
* **Description:** Records user leaving group before restaurant selected (-5 credibility).

void recordLateCancellation(String userId, String roomId)

* **Parameters:** `userId` \- User's unique identifier, `roomId` \- Room's unique identifier  
* **Returns:** void  
* **Description:** Records late room cancellation (-10 credibility).

List\<CredibilityLog\> getUserCredibilityLogs(String userId, int limit)

* **Parameters:** `userId` \- User's unique identifier, `limit` \- Maximum logs to return (default 20\)  
* **Returns:** List of CredibilityLog objects  
* **Description:** Retrieves credibility change history for transparency.

CredibilityStats getUserCredibilityStats(String userId)

* **Parameters:** `userId` \- User's unique identifier  
* **Returns:** CredibilityStats object with currentScore, totalLogs, positiveActions, negativeActions, recentTrend  
* **Description:** Calculates statistics and trend (improving/stable/declining) based on recent 10 actions.

boolean isCredibilityAcceptable(double score, double minimumRequired)

* **Parameters:** `score` \- User's current score, `minimumRequired` \- Minimum threshold (default 50\)  
* **Returns:** Boolean indicating if score meets requirement  
* **Description:** Checks if user meets minimum credibility for matching.

void restoreCredibilityScore(String userId, int amount, String notes)

* **Parameters:** `userId` \- User's unique identifier, `amount` \- Points to restore, `notes` \- Reason for restoration  
* **Returns:** void  
* **Description:** Manually restores credibility (admin function or appeal system).

---

## **7\. Notification Service Interface**

**Purpose:** Sends Firebase Cloud Messaging push notifications to users.

### **Methods:**

void sendNotificationToUser(String userId, NotificationPayload notification)

* **Parameters:** `userId` \- User's unique identifier, `notification` \- Object with title, body, data  
* **Returns:** void  
* **Description:** Sends push notification to single user via FCM token; logs warning if no token registered.

void sendNotificationToUsers(List\<String\> userIds, NotificationPayload notification)

* **Parameters:** `userIds` \- List of user identifiers, `notification` \- Notification payload  
* **Returns:** void  
* **Description:** Sends multicast notification to multiple users efficiently.

void notifyRoomMembers(List\<String\> memberIds, NotificationPayload notification)

* **Parameters:** `memberIds` \- Room member user IDs, `notification` \- Notification payload  
* **Returns:** void  
* **Description:** Sends notification to all members of a waiting room.

void notifyGroupMembers(List\<String\> memberIds, NotificationPayload notification)

* **Parameters:** `memberIds` \- Group member user IDs, `notification` \- Notification payload  
* **Returns:** void  
* **Description:** Sends notification to all members of a group.

void notifyRoomMatched(String userId, String roomId, String groupId)

* **Parameters:** `userId` \- User's unique identifier, `roomId` \- Room ID, `groupId` \- New group ID  
* **Returns:** void  
* **Description:** Notifies user that room is full and group is ready for voting.

void notifyRoomExpired(String userId, String roomId)

* **Parameters:** `userId` \- User's unique identifier, `roomId` \- Room ID  
* **Returns:** void  
* **Description:** Notifies user that waiting room expired without enough members.

void notifyRestaurantSelected(List\<String\> memberIds, String restaurantName, String groupId)

* **Parameters:** `memberIds` \- Group member user IDs, `restaurantName` \- Selected restaurant name, `groupId` \- Group ID  
* **Returns:** void  
* **Description:** Notifies all group members when restaurant voting is complete.

---

## **8\. Socket Manager Interface**

**Purpose:** Manages real-time Socket.IO communication for rooms and groups.

### **Methods:**

void emitRoomUpdate(String roomId, List\<String\> members, Date expiresAt, String status)

* **Parameters:** `roomId` \- Room's unique identifier, `members` \- List of user IDs, `expiresAt` \- Expiration timestamp, `status` \- 'waiting'|'matched'|'expired'  
* **Returns:** void  
* **Description:** Broadcasts updated room state to all connected members in room channel.

void emitGroupReady(String roomId, String groupId, List\<String\> members)

* **Parameters:** `roomId` \- Room's unique identifier, `groupId` \- New group ID, `members` \- List of user IDs  
* **Returns:** void  
* **Description:** Notifies all room members that group formation is complete and voting begins.

void emitRoomExpired(String roomId, String reason)

* **Parameters:** `roomId` \- Room's unique identifier, `reason` \- Expiration reason message  
* **Returns:** void  
* **Description:** Notifies room members that room expired without forming group.

void emitVoteUpdate(String groupId, String restaurantId, Map\<String, Integer\> votes, int membersVoted, int totalMembers)

* **Parameters:** `groupId` \- Group's unique identifier, `restaurantId` \- Restaurant ID, `votes` \- Vote count map, `membersVoted` \- Number who voted, `totalMembers` \- Total group size  
* **Returns:** void  
* **Description:** Broadcasts real-time voting progress to all group members in group channel.

void emitRestaurantSelected(String groupId, String restaurantId, String restaurantName, Map\<String, Integer\> votes)

* **Parameters:** `groupId` \- Group's unique identifier, `restaurantId` \- Restaurant ID, `restaurantName` \- Restaurant name, `votes` \- Final vote counts  
* **Returns:** void  
* **Description:** Notifies all group members that restaurant has been selected by majority vote.

void emitMemberJoined(String roomId, String userId, String userName, int currentMembers, int maxMembers)

* **Parameters:** `roomId` \- Room's unique identifier, `userId` \- New member ID, `userName` \- New member name, `currentMembers` \- Current count, `maxMembers` \- Maximum capacity  
* **Returns:** void  
* **Description:** Notifies room members when new user joins waiting room.

void emitMemberLeft(String roomId, String userId, String userName, int remainingMembers)

* **Parameters:** `roomId` \- Room's unique identifier, `userId` \- Departing user ID, `userName` \- Departing user name, `remainingMembers` \- Remaining member count  
* **Returns:** void  
* **Description:** Notifies room/group members when user leaves.

void emitToUser(String userId, String event, Object payload)

* **Parameters:** `userId` \- Target user's unique identifier, `event` \- Event name, `payload` \- Event data  
* **Returns:** void  
* **Description:** Sends event directly to specific user's socket connection.

---

## **9\. Database Model Interfaces (Mongoose)**

### **User Model**

User create(UserData userData)

User findById(String userId)

User findOne(Query query)

User findByIdAndUpdate(String userId, UpdateData updates)

boolean findByIdAndDelete(String userId)

List\<User\> find(Query query)

List\<User\> findByIds(List\<String\> userIds)

### **Room Model**

Room create(RoomData roomData)

Room findById(String roomId)

Room findOne(Query query)

Room findByIdAndUpdate(String roomId, UpdateData updates)

boolean findByIdAndDelete(String roomId)

List\<Room\> find(Query query)

List\<Room\> findActiveRooms()

Room findByUserId(String userId)

### **Group Model**

Group create(GroupData groupData)

Group findById(String groupId)

Group findOne(Query query)

Group findByIdAndUpdate(String groupId, UpdateData updates)

boolean findByIdAndDelete(String groupId)

List\<Group\> find(Query query)

Group findByUserId(String userId)

List\<Group\> findActiveGroups()

void addVote(String userId, String restaurantId)

void removeVote(String userId)

int getVoteCount(String restaurantId)

String getWinningRestaurant()

boolean hasAllVoted()

void removeMember(String userId)

### **CredibilityLog Model**

CredibilityLog create(LogData logData)

List\<CredibilityLog\> findByUserId(String userId, int limit)

List\<CredibilityLog\> getRecentLogs(int days)

---

## **10\. External API Interfaces**

### **Google Auth Library**

TokenInfo verifyIdToken(String idToken)

* **Parameters:** `idToken` \- Google ID token from client  
* **Returns:** TokenInfo with userId (sub), email, name, picture  
* **Description:** Validates Google OAuth token against Google's servers.

### **Google Places API (HTTP/REST)**

GET https://maps.googleapis.com/maps/api/place/nearbysearch/json

Query Parameters: location, radius, type, keyword, key

Returns: { results: Restaurant\[\] }

* **Description:** Searches for restaurants near specified location.

GET https://maps.googleapis.com/maps/api/place/details/json

Query Parameters: place\_id, fields, key

Returns: { result: Restaurant }

* **Description:** Retrieves detailed restaurant information.

### **Firebase Cloud Messaging**

String send(Message message)

* **Parameters:** `message` \- FCM message object with token, notification, data  
* **Returns:** Message ID string  
* **Description:** Sends push notification to user's device.

BatchResponse sendEachForMulticast(MulticastMessage message)

* **Parameters:** `message` \- FCM multicast message with tokens\[\], notification, data  
* **Returns:** BatchResponse with success/failure counts  
* **Description:** Sends notification to multiple devices efficiently.

**Frontend \<-\> Backend Interfaces**

\#\# Base Information

\*\*Base URL:\*\* \`http://localhost:3000\` (Development)    
\*\*API Version:\*\* 1.0    
\*\*Protocol:\*\* REST \+ WebSocket (Socket.IO)

\---

\#\# Table of Contents  
1\. \[Authentication\](\#authentication)  
2\. \[User Management\](\#user-management)  
3\. \[Matching System\](\#matching-system)  
4\. \[Group System\](\#group-system)  
5\. \[Restaurant System\](\#restaurant-system)  
6\. \[WebSocket Events\](\#websocket-events)  
7\. \[Error Handling\](\#error-handling)  
8\. \[Data Models\](\#data-models)

\---

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:  
\`\`\`  
Authorization: Bearer \<JWT\_TOKEN\>  
\`\`\`

### POST /api/auth/signin

Purpose: Exchange Google ID token for JWT authentication token.

\*\*Request:\*\*  
\`\`\`json  
{  
  "idToken": "string" // Google OAuth ID token  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "token": "string", // JWT token for future requests  
  "user": {  
    "userId": "string",  
    "name": "string",  
    "email": "string",  
    "profilePicture": "string",  
    "credibilityScore": 100  
  }  
}  
\`\`\`

\*\*Errors:\*\*  
\- 400: Invalid request (missing idToken)  
\- 401: Invalid Google token

### POST /api/auth/signup

Purpose: Exchange Google ID token for JWT authentication token.

\*\*Request:\*\*  
\`\`\`json  
{  
  "idToken": "string" // Google OAuth ID token  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "token": "string", // JWT token for future requests  
  "user": {  
    "userId": "string",  
    "name": "string",  
    "email": "string",  
    "profilePicture": "string",  
    "credibilityScore": 100  
  }  
}  
\`\`\`

\*\*Errors:\*\*  
\- 400: Invalid request (missing idToken)  
\- 401: Invalid Google token

### POST /api/auth/google

Purpose: Exchange Google ID token for JWT authentication token.

\*\*Request:\*\*  
\`\`\`json  
{  
  "idToken": "string" // Google OAuth ID token  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "token": "string", // JWT token for future requests  
  "user": {  
    "userId": "string",  
    "name": "string",  
    "email": "string",  
    "profilePicture": "string",  
    "credibilityScore": 100  
  }  
}  
\`\`\`

\*\*Errors:\*\*  
\- 400: Invalid request (missing idToken)  
\- 401: Invalid Google token

\---

### POST /api/auth/logout

Purpose: Logout current user (sets status to offline).

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

No Request parameters

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "message": "Logged out successfully"  
}  
\`\`\`

\---

### POST /api/auth/fcm-token

Purpose: Update user's Firebase Cloud Messaging token for push notifications.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Request:\*\*  
\`\`\`json  
{  
  "fcmToken": "string"  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "message": "FCM token updated successfully"  
}  
\`\`\`

\---

### DELETE /api/auth/account

Delete user account (cannot be in a room or group).

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "message": "Account deleted successfully"  
}  
\`\`\`

\*\*Errors:\*\*  
\- 400: User is in a room or group

\---

## User Management

### GET /api/user/profile/:ids

Get user profiles by IDs (comma-separated).

\*\*Parameters:\*\*  
\- \`ids\` (path): Comma-separated user IDs (e.g., "user1,user2,user3")

\*\*Response (200):\*\*  
\`\`\`json  
\[  
  {  
    "userId": "string",  
    "name": "string",  
    "bio": "string",  
    "profilePicture": "string",  
    "contactNumber": "string"  
  }  
\]  
\`\`\`

\---

### GET /api/user/settings

Get current user's settings and preferences.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": {},  
  "Body": {  
    "userId": "string",  
    "name": "string",  
    "bio": "string",  
    "preference": \["string"\], // cuisine preferences  
    "profilePicture": "string",  
    "credibilityScore": 100,  
    "contactNumber": "string",  
    "budget": 50,  
    "radiusKm": 5,  
    "status": 1, // 0: offline, 1: online, 2: in\_waiting\_room, 3: in\_group  
    "roomID": "string" | null,  
    "groupID": "string" | null  
  }  
}  
\`\`\`

\---

### POST /api/user/profile

Create or update user profile.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Request:\*\*  
\`\`\`json  
{  
  "name": "string",  
  "bio": "string",  
  "profilePicture": "string",  
  "contactNumber": "string"  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": { "text": "Profile updated successfully" },  
  "Body": {  
    "userId": "string",  
    "name": "string",  
    "bio": "string",  
    "profilePicture": "string",  
    "contactNumber": "string"  
  }  
}  
\`\`\`

\---

### POST /api/user/settings

Update user settings and preferences.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Request:\*\*  
\`\`\`json  
{  
  "name": "string",  
  "bio": "string",  
  "preference": \["Italian", "Japanese", "Mexican"\], // cuisine preferences  
  "profilePicture": "string",  
  "contactNumber": "string",  
  "budget": 50,  
  "radiusKm": 5  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": { "text": "Settings updated successfully" },  
  "Body": { /\* Updated settings object \*/ }  
}  
\`\`\`

\---

### PUT /api/user/profile

Update user profile (similar to POST but uses PUT method).

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Request:\*\* Same as POST /api/user/profile

\*\*Response:\*\* Same as POST /api/user/profile

\---

### DELETE /api/user/:userId

Delete a user account.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Parameters:\*\*  
\- \`userId\` (path): User ID to delete (must match authenticated user)

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": { "text": "User deleted successfully" },  
  "Body": { "deleted": true }  
}  
\`\`\`

\*\*Errors:\*\*  
\- 403: Can only delete own account  
\- 400: Cannot delete while in room/group

\---

## Matching System

### POST /api/matching/join

Join the matching pool to find a group.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Request:\*\*  
\`\`\`json  
{  
  "cuisine": \["Italian", "Japanese"\], // preferred cuisines  
  "budget": 50,  
  "radiusKm": 5  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": { "text": "Successfully joined matching" },  
  "Body": {  
    "roomId": "string",  
    "room": {  
      "roomId": "string",  
      "completionTime": "2025-01-19T20:30:00.000Z",  
      "maxMembers": 4,  
      "members": \["userId1", "userId2"\],  
      "status": "waiting", // "waiting" | "matched" | "expired"  
      "cuisine": "Italian",  
      "averageBudget": 45,  
      "averageRadius": 5  
    }  
  }  
}  
\`\`\`

\*\*Notes:\*\*  
\- User will be matched to existing room or new room created  
\- When room fills (4 members), group is automatically created  
\- Real-time updates sent via WebSocket

\---

### PUT /api/matching/leave/:roomId

Leave a waiting room.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Parameters:\*\*  
\- \`roomId\` (path): Room ID to leave

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": { "text": "Successfully left room" },  
  "Body": { "roomId": "string" }  
}  
\`\`\`

\---

### GET /api/matching/status/:roomId

Get current status of a waiting room.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Parameters:\*\*  
\- \`roomId\` (path): Room ID

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": {},  
  "Body": {  
    "roomID": "string",  
    "completionTime": 1705699800000, // Unix timestamp in milliseconds  
    "members": \["userId1", "userId2"\],  
    "groupReady": false,  
    "status": "waiting" // "waiting" | "matched" | "expired"  
  }  
}  
\`\`\`

\---

### GET /api/matching/users/:roomId

Get list of users in a room.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Parameters:\*\*  
\- \`roomId\` (path): Room ID

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": {},  
  "Body": {  
    "roomID": "string",  
    "Users": \["userId1", "userId2", "userId3"\]  
  }  
}  
\`\`\`

\---

## Group System

### GET /api/group/status

Get current user's group status.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": {},  
  "Body": {  
    "roomId": "string",  
    "completionTime": 1705699800000,  
    "numMembers": 4,  
    "users": \["userId1", "userId2", "userId3", "userId4"\],  
    "restaurantSelected": false,  
    "restaurant": {  
      "name": "string",  
      "location": "string",  
      "restaurantId": "string",  
      "priceLevel": 2,  
      "rating": 4.5  
    },  
    "status": "voting" // "voting" | "matched" | "completed" | "disbanded"  
  }  
}  
\`\`\`

\*\*Errors:\*\*  
\- 404: User not in a group

\---

### POST /api/group/vote/:groupId

Vote for a restaurant in your group.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Parameters:\*\*  
\- \`groupId\` (path): Group ID

\*\*Request:\*\*  
\`\`\`json  
{  
  "restaurantID": "string",  
  "restaurant": {  
    "name": "Sushi Paradise",  
    "location": "123 Main St, Vancouver, BC",  
    "restaurantId": "rest\_001",  
    "priceLevel": 2,  
    "rating": 4.5,  
    "phoneNumber": "+1-604-555-0001",  
    "url": "https://example.com/sushi-paradise"  
  }  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": { "text": "Voting successful" },  
  "Body": {  
    "Current\_votes": {  
      "rest\_001": 3,  
      "rest\_002": 1  
    }  
  }  
}  
\`\`\`

\*\*Notes:\*\*  
\- Real-time vote updates sent via WebSocket to all group members  
\- When all members vote, restaurant with most votes is automatically selected

\---

### POST /api/group/leave/:groupId

Leave a group.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Parameters:\*\*  
\- \`groupId\` (path): Group ID to leave

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": { "text": "Successfully left group" },  
  "Body": { "groupId": "string" }  
}  
\`\`\`

\*\*Notes:\*\*  
\- Affects credibility score  
\- If all members leave, group is deleted

\---

## Restaurant System

### GET /api/restaurant/search

Search for restaurants near a location.

\*\*Query Parameters:\*\*  
\- \`latitude\` (required): Latitude coordinate (e.g., 49.2827)  
\- \`longitude\` (required): Longitude coordinate (e.g., \-123.1207)  
\- \`radius\`: Search radius in meters (default: 5000\)  
\- \`cuisineTypes\`: Comma-separated cuisine types (e.g., "Italian,Japanese")  
\- \`priceLevel\`: Price level 1-4 (1=cheap, 4=expensive)

\*\*Example:\*\*  
\`\`\`  
GET /api/restaurant/search?latitude=49.2827\&longitude=-123.1207\&radius=5000\&cuisineTypes=Italian,Japanese\&priceLevel=2  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": {},  
  "Body": \[  
    {  
      "name": "Sushi Paradise",  
      "location": "123 Main St, Vancouver, BC",  
      "restaurantId": "rest\_001",  
      "address": "123 Main St, Vancouver, BC",  
      "priceLevel": 2,  
      "rating": 4.5,  
      "photos": \["url1", "url2"\],  
      "phoneNumber": "+1-604-555-0001",  
      "website": "https://example.com",  
      "url": "https://maps.google.com/..."  
    }  
  \]  
}  
\`\`\`

\---

### GET /api/restaurant/:restaurantId

Get detailed information about a specific restaurant.

\*\*Parameters:\*\*  
\- \`restaurantId\` (path): Restaurant ID

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": {},  
  "Body": {  
    "name": "string",  
    "location": "string",  
    "restaurantId": "string",  
    "address": "string",  
    "priceLevel": 2,  
    "rating": 4.5,  
    "photos": \["url1"\],  
    "phoneNumber": "string",  
    "website": "string",  
    "url": "string"  
  }  
}  
\`\`\`

\---

### POST /api/restaurant/recommendations/:groupId

Get restaurant recommendations for a group.

\*\*Headers:\*\* \`Authorization: Bearer \<token\>\`

\*\*Parameters:\*\*  
\- \`groupId\` (path): Group ID

\*\*Request:\*\*  
\`\`\`json  
{  
  "userPreferences": \[  
    {  
      "cuisineTypes": \["Italian", "Japanese"\],  
      "budget": 50,  
      "location": {  
        "coordinates": \[-123.1207, 49.2827\]  
      },  
      "radiusKm": 5  
    }  
  \]  
}  
\`\`\`

\*\*Response (200):\*\*  
\`\`\`json  
{  
  "Status": 200,  
  "Message": {},  
  "Body": \[  
    { /\* Restaurant objects \*/ }  
  \]  
}  
\`\`\`

\---

## WebSocket Events

Connect to Socket.IO at: \`http://localhost:3000\`

### Authentication

Send JWT token during connection:  
\`\`\`javascript  
const socket \= io('http://localhost:3000', {  
  auth: {  
    token: 'YOUR\_JWT\_TOKEN'  
  }  
});  
\`\`\`

\---

### Client → Server Events

#### join\_room

Join a room to receive updates.  
\`\`\`javascript  
socket.emit('join\_room', { userId: 'user123' });  
\`\`\`

#### leave\_room

Leave a room.  
\`\`\`javascript  
socket.emit('leave\_room', { userId: 'user123' });  
\`\`\`

#### subscribe\_to\_room

Subscribe to room updates.  
\`\`\`javascript  
socket.emit('subscribe\_to\_room', 'room\_123');  
\`\`\`

#### subscribe\_to\_group

Subscribe to group updates.  
\`\`\`javascript  
socket.emit('subscribe\_to\_group', 'group\_123');  
\`\`\`

\---

### Server → Client Events

#### room\_update

Sent when room status changes.  
\`\`\`javascript  
socket.on('room\_update', (data) \=\> {  
  // data \= {  
  //   roomId: 'string',  
  //   members: \['userId1', 'userId2'\],  
  //   expiresAt: '2025-01-19T20:30:00.000Z',  
  //   status: 'waiting' | 'matched' | 'expired'  
  // }  
});  
\`\`\`

#### group\_ready

Sent when a group is formed (room is full).  
\`\`\`javascript  
socket.on('group\_ready', (data) \=\> {  
  // data \= {  
  //   groupId: 'string',  
  //   members: \['userId1', 'userId2', 'userId3', 'userId4'\],  
  //   ready: true  
  // }  
});  
\`\`\`

#### room\_expired

Sent when a room expires.  
\`\`\`javascript  
socket.on('room\_expired', (data) \=\> {  
  // data \= {  
  //   roomId: 'string',  
  //   reason: 'Not enough members'  
  // }  
});  
\`\`\`

#### vote\_update

Sent when someone votes in a group.  
\`\`\`javascript  
socket.on('vote\_update', (data) \=\> {  
  // data \= {  
  //   restaurantId: 'string',  
  //   votes: { 'rest\_001': 3, 'rest\_002': 1 },  
  //   totalVotes: 4,  
  //   membersVoted: 3,  
  //   totalMembers: 4  
  // }  
});  
\`\`\`

#### restaurant\_selected

Sent when a restaurant is selected.  
\`\`\`javascript  
socket.on('restaurant\_selected', (data) \=\> {  
  // data \= {  
  //   restaurantId: 'string',  
  //   restaurantName: 'Sushi Paradise',  
  //   votes: { 'rest\_001': 3, 'rest\_002': 1 }  
  // }  
});  
\`\`\`

#### member\_joined

Sent when a member joins a room.  
\`\`\`javascript  
socket.on('member\_joined', (data) \=\> {  
  // data \= {  
  //   userId: 'string',  
  //   userName: 'string',  
  //   currentMembers: 2,  
  //   maxMembers: 4  
  // }  
});  
\`\`\`

#### member\_left

Sent when a member leaves.  
\`\`\`javascript  
socket.on('member\_left', (data) \=\> {  
  // data \= {  
  //   userId: 'string',  
  //   userName: 'string',  
  //   remainingMembers: 2  
  // }  
});  
\`\`\`

\---

## Error Handling

### Standard Error Response

\`\`\`json  
{  
  "error": "Error Type",  
  "message": "Detailed error message",  
  "statusCode": 400  
}  
\`\`\`

### Common HTTP Status Codes

\- \*\*200\*\*: Success  
\- \*\*400\*\*: Bad Request (invalid input)  
\- \*\*401\*\*: Unauthorized (missing/invalid token)  
\- \*\*403\*\*: Forbidden (insufficient permissions)  
\- \*\*404\*\*: Not Found  
\- \*\*409\*\*: Conflict (duplicate resource)  
\- \*\*500\*\*: Internal Server Error

\---

**Databases**

- UserDB  
- GroupDB  
  - Table : Rooms  
  - Table: Groups

#### **4.2 Frameworks**

*(List all frameworks \+ rationale, e.g., Express.js, Retrofit, Jetpack Compose, Socket.io, Prisma, AWS EC2)*

#### *Frontend:*

| Framework | Rational |
| :---- | :---- |
| Kotlin | For general frontend code. Used often in industry for similar styled apps.  |
| Google Authentication | Outside of the backend explanation, we note that the familiar google dialog creates a layer of trust.  |
| ThreeTenABP | Helps manage time information; it is a port of JSR-310. The value is that it encapsulates date items.  |
| Jetpack Compose | It allows for very strong encapsulation within the UI layer, thus speeding up development, furthermore it is by android, for android. We also use DataStore from compose to help with how we store data on the front end.  We use material icons from compose as well for ease of use  |
| Square Retrofit2 | We use retrofit as an encapsulation layer from http to kotlin, this reduces error on the parsing step.  |
| Square OkHttp3  | We encapsulate our http client through this api. It saves a lot of networking code.  |
| Socket IO | Handles our asynchronous requests from the backend. We chose socket as it was a strong fit for our project.  |

#### *Backend:*	

| Framework | Rational |
| :---- | :---- |
| Typescript | For general backend code. It’s a solid language for this type of programming, used a lot in industry.  |
| MongoDB | Database. Initially we were planning to use PostgresSQL, however we decided to swap because MongoDB served our tasks better, specifically the document database better stored the way we wanted to hold user information and group information. |
| Google Authentication | For user authentication, the main rationale was the security we can derive from encapsulating. In security you are as strong as your weakest link, ergo google a strong link.  |
| Firebase Admin | We used firebase admin to handle our push notifications. We chose to use it over other notification tools as it seemed this one was the most well maintained. |
| Socket io | We choose socket to handle our asynchronous requests to the client as it is a very strong tool. We choose it over its competitors as it better fits our use case.  |
| Axios | Axios helps handle http requests; we use it as it is a functional encapsulation layer allowing our code to be more human readable.  |
| Zod | Zod is used to parse schemas, similar to axios it helps encapsulate the layer between typescript object and http request.  |
| Express | We use express to allow for easy HTTP requests, the rationale for using it is that it is the main service for this type of task.  |

#### **4.3 Dependency Diagram**

*(Insert diagram image here — lifelines for each component)*

*User Service*

*Matching Service*

*Group Service*

*Restaurant Service*

*Credibility Service* 

#### **4.4 Databases**

We are using MongoDB and we have a couple different but helpful collections:

1. Users. collection: user

We store a user with the information as cited in the structure of a user section. The rational for storing user information is quite simple, mainly we want to have users and a lot of our tasks involve selected a singular user as such users need to be stored separately

2. Rooms 

Following the structure in the structure of a room section. We store the rooms as a separate collection due to their access pattern. We often have a need for a room so being able to access them as a separate query is very helpful. A note on the implementation rational, we store the user ids of the members so we can query by user id’s at a later point, this helps keep the frontend and backend encapsulated in a very organized fashion. 

3. Groups

Defined in the structure of a group section we store a collection of these group objects. This again allows for quick access to the specific group. Something interesting about the implementation is that we tried to keep data very closely related to the group to minimize queries. An example of this are votes. We have the related votes for a room come with the query to reduce server load. 

4. Restaurants 

Defined in the structure of a restaurant section we store restaurants as their own special object as we need to load lots of separate restaurants, thus by having it as their own object we can keep things organized. Furthermore we work with the google places api so we can have a very quick access pattern. 

5. Credibility Logging, credibility\_logs

We have a logging system for credibility (collection written this paragraph),  which contains the relevant logging information for credibility changes. We utilize this collection to allow documentation of changes in credibility. This includes notes to help with repeat offenders. Alongside helping speed up our process, part of the rationale for this item was during our presentation we were asked about how we can manage repeat offenders. By utilizing an advanced logging system we can keep track of the offenders thus allowing us to moderate in a safer fashion. 

{

  \_id: ObjectId,

  userId: string,           

  action: 'no\_show'|'late\_cancel'|'left\_group\_early'|'completed\_meetup'|'positive\_review'|'negative\_review'

  scoreChange: number,    

  previousScore: number,

  newScore: number,

  groupId?: string,

  roomId?: string,

  notes?: string,

  createdAt: Date,

}

#### **4.5 External Modules**

*(Google Auth, Places API, Firebase, etc.)*

| Name  | Rational  |
| :---- | :---- |
| Google Authentication | Handles all authentication, encapsulates security  |
| Google Places | Places lets us parse geospatial data to get relevant restaurants for our users. It is a critical component as there are not a lot of other services that do this. |
| Firebase Admin | Handles push notifications for our users. The rationale for this service is that it helps encapsulate a very complicated android behavior.  |

#### **4.6 Sequence Diagrams**

*(One per 5 major use cases. Insert diagrams as images.)*

***4.6.1 Set Preferences*** 

*![][image3]*

***4.6.2 \- Request Matches*** 

***![][image4]***

***4.6.3 \- Receive Notification about Match***

***![][image5]***

***4.6.4 \- Vote on Restaurant*** 

***![][image6]***

***4.6.5 \- View Restaurant Choice***

#### **![][image7]**

[*https://app.diagrams.net/\#G1q9MxsTL9xvzYNCV5fXcTlO\_P9JBD3SdL\#%7B%22pageId%22%3A%2213e1069c-82ec-6db2-03f1-153e76fe0fe0%22%7D*](https://app.diagrams.net/#G1q9MxsTL9xvzYNCV5fXcTlO_P9JBD3SdL#%7B%22pageId%22%3A%2213e1069c-82ec-6db2-03f1-153e76fe0fe0%22%7D) 

#### **4.7 Non-Functional Requirements Implementation**

| Non-Functional Requirement | How it is Implemented |
| ----- | ----- |
| Performance: System must return a restaurant match suggestion in 5 seconds for 90% of requests 95% of major user interactions must respond within 2 seconds | We were able to implement both of the performance requirements due to some main reasons. Firstly we use light weight REST api calls, so we are never doing insanely high computational tasks. Secondly for longer items like waiting rooms, which are by design going to be long, we have it as an asynchronous call; thus not making it blocking.   |
| Scalability The matchmaking algorithm must support up to 100 concurrent users in the waiting room. The system must be able to support 1000 users.  | We have purposely designed the application to be as scalable as possible. Specifically the vast majority of the code runs in O(N) where N is the number of user’s time, furthermore our database is not a limitation as we can continually add to it. Furthermore the server is not going to pose a limitation on the quantity of users; by virtue of the scaling models of modern cloud hosting. Currently, it is set up so the room has a maximum of 10 people, but this could be easily expanded to 100\. This can be done by simply changing the constant in the backend file. |
| Reliability System must be up 90% of the time | We host our system on a AWS EC2 instance, alongside depending on Firebase administration, while depending on multiple pieces of infrastructure does promote some risk, for the most part these cloud hosting services do not go offline.  Reliability is a function of our cloud providers. We have our system automatically reboot if something goes down.  Thus we can say that our reliability will be AWS’ EC2s reliability: 99.99% (\> 90%) |

---

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,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F77wBdoFQ2nvwP3rv/7r3X9q+Jd/+Zd7y0noAGDdrjIDEpX7rD2+/vWv303cicPI/uEf/uGNxO7bv/3bT7/6q796b5kldSR2AEACt2s+geNOHGZjd+Ws33t/93d/d/r7v/97kjgA09tVRkCCcp9P4JTEcRcOs7DPyv37v//7vWW/+Iu/ePq2b/u203/+53/eW/7f//3f9+YBYHS7yphI4O5rEzjuxAGnN77wYM+/93u/9/TXf/3Xb9yZ++ijj+7NA8AodpUJkJjct5TAcScOuO8//uM/Tu+8887dlyE8S+b++I//mLtzAIa0q4yJBO6+tQTO34kjkQOW/e3f/u3px37sx95I7H73d3/39I//+I/3lgHA0ewqYyKBuy9K4HwSB+B83/md33l677337i2zt1q5UwfgSHb16n9JMvLs2bN781b2xYsX95Zd6qHyjx8/fv385cuXr/fBnlv99thSGR2b38ZDHkrglMRxFw4439tvv333o8LeV77ylbux1P6UCQDs1fkZ0wZ6JHC23J77bdnPEfgEzx4tkWrrs+U2PXny5I1tGJ+g2Tq2XSVyNm9UTutaParfltm81WHzqkf7pXl71PbO0e4ngMt86UtfOv3SL/3SG196+LVf+7XTX/7lX76xHABubVev/JckImsJnN+G1vHJlbH1nj9//no9UQLXlvOUbFlSZnHbjpIyv02VXboDp/1U4ueXad2lutdc0m4AzvdDP/RDpz/4gz944+1V+xmT9huvALClXb3yX5KILCVwdodLiZC2pbc3NVmSZessvd2pBE6xpSRPSZs92nqWyPm3RVXPOQmclbdtKRlUGe7AAfv11a9+9fQd3/Edd/89wvvGN75x+uY3v3lvGQBcy65e+S9JRNrkSgmR5z+j5lUSOH/nTfOqxyeVJHDAmOwHht999903fmT4J37iJ06//du/fW8ZAFzLrl75L01E/J01scSnXabPoCnpqiRwlqT5O25+Hd3ts/psMlpXidtaAme07yRwwPH84R/+4elv/uZv2sUAcBW7euUnEflfltAtJY9raDcAAOayq1f+mRMR/+3ZS+6+mZnbDQCAGe3qlZ9EJId2AwBgLrt65ScRyaHdAACYy65e+W+RiOhtS5v0ZYKjuUW7AQCA29nVK/8tEhH7Rqj4nwQ5klu0GwAAuJ1dvfLfIhHxCZx9eUA/+2HfArX9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>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,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>