         // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyB2Jnp6NzVxiy_OBUXmzkzjdmt68Wb7X-w",
            authDomain: "streamplay-pro.firebaseapp.com",
            databaseURL: "https://streamplay-pro-default-rtdb.firebaseio.com",
            projectId: "streamplay-pro",
            storageBucket: "streamplay-pro.firebasestorage.app",
            messagingSenderId: "188069541745",
            appId: "1:188069541745:web:6347e0bc4c0144e1c1a8d0",
            measurementId: "G-PQXNRQSEYR"
        };
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();
        // App state variables
        let darkMode = false;
        let currentFilter = "all";
        let searchQuery = "";
        let currentUser = null;
        let currentPage = 'auth';
        let posts = [];
        let messages = [];
        let users = {};
        let logs = [];
        let allComments = [];
        let editingUserEmail = null;
        // Logs state
        let logsSortBy = 'timestamp';
        let logsSortDir = 'desc';
        let logsPerPage = 20;
        let currentLogPage = 1;
        let allActors = new Set();
        // Real-time listeners
        let postsListener = null;
        let messagesListener = null;
        let usersListener = null;
        let logsListener = null;
        let usersAddedListener = null;
        let postsAddedListener = null;
        let messagesAddedListener = null;
        // Initial load flag
        let initialLoaded = { users: false, posts: false, messages: false };
        // DOM elements
        const postsSection = document.getElementById('postsSection');
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        const lastUpdate = document.getElementById('lastUpdate');
        const authSection = document.getElementById('authSection');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const contactForm = document.getElementById('contactForm');
        const messagesList = document.getElementById('messagesList');
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const menuList = document.getElementById('menuList');
        const sidebarTitle = document.getElementById('sidebarTitle');
        const sidebarSubtitle = document.getElementById('sidebarSubtitle');
        const sidebarLogout = document.getElementById('sidebarLogout');
        const profileInfo = document.getElementById('profileInfo');
        const settingsForm = document.getElementById('settingsForm');
        const deleteAccountBtn = document.getElementById('deleteAccount');
        const savePreferencesBtn = document.getElementById('savePreferences');
        // Admin elements
        const adminStats = document.getElementById('adminStats');
        const usersList = document.getElementById('usersList');
        const messagesAdminList = document.getElementById('messagesAdminList');
        const userCount = document.getElementById('userCount');
        const messageCount = document.getElementById('messageCount');
        const logCount = document.getElementById('logCount');
        const userSearch = document.getElementById('userSearch');
        const messageSearch = document.getElementById('messageSearch');
        const logSearch = document.getElementById('logSearch');
        const logsTableBody = document.getElementById('logsTableBody');
        const logsPagination = document.getElementById('logsPagination');
        const logActionFilter = document.getElementById('logActionFilter');
        const logTypeFilter = document.getElementById('logTypeFilter');
        const logActorFilter = document.getElementById('logActorFilter');
        const logRoleFilter = document.getElementById('logRoleFilter');
        const backupBtn = document.getElementById('backupBtn');
        const restoreFile = document.getElementById('restoreFile');
        const restoreBtn = document.getElementById('restoreBtn');
        const adminSettingsForm = document.getElementById('adminSettingsForm');
        // Post management elements
        const postCount = document.getElementById('postCount');
        const postSearch = document.getElementById('postSearch');
        const adminPostsList = document.getElementById('adminPostsList');
        // Modal elements
        const userModal = document.getElementById('userModal');
        const viewDetails = document.getElementById('viewDetails');
        const editUserForm = document.getElementById('editUserForm');
        const modalTitle = document.getElementById('modalTitle');
        const editBtn = document.getElementById('editBtn');
        const closeModal = document.querySelector('.close');
        // AI simple words
        const positiveWords = ['good', 'great', 'love', 'awesome', 'excellent', 'perfect'];
        const negativeWords = ['bad', 'hate', 'terrible', 'awful', 'disgusting', 'spam'];
        // Helper function to strip HTML tags for plain text sanitization
        function stripHtml(text) {
            const div = document.createElement('div');
            div.innerHTML = text;
            return div.textContent || div.innerText || '';
        }
        // Helper function to preserve line breaks in HTML
        function preserveLineBreaks(text) {
            if (!text) return '';
            return text.replace(/\n/g, '<br>');
        }
        // Helper function to sanitize Firebase keys for emails
        function sanitizeKey(key) {
            return btoa(encodeURIComponent(key));
        }
        // Helper function to unsanitize Firebase keys
        function unsanitizeKey(key) {
            return decodeURIComponent(atob(key));
        }
        // Get user role by actor (email or username)
        function getUserRole(actor) {
            if (actor.includes('@')) {
                return users[actor]?.role || 'guest';
            } else {
                for (const [email, user] of Object.entries(users)) {
                    if (user.username === actor) {
                        return user.role || 'guest';
                    }
                }
                return 'guest';
            }
        }
        // Process users data
        function processUsers(rawData) {
            const data = rawData || {};
            const unsanitized = Object.fromEntries(
                Object.entries(data).map(([skey, value]) => [unsanitizeKey(skey), value])
            );
            Object.keys(unsanitized).forEach(email => {
                let user = unsanitized[email];
                if (user.isAdmin !== undefined && !user.role) {
                    user.role = user.isAdmin ? 'admin' : 'user';
                    delete user.isAdmin;
                } else if (!user.role) {
                    user.role = 'user';
                }
                user.sessionPostLikes = user.sessionPostLikes || [];
                user.logins = user.logins || [];
                user.logouts = user.logouts || [];
                user.createdAt = user.createdAt || new Date().toISOString();
            });
            return unsanitized;
        }
        function computeAllComments() {
            allComments = [];
            posts.forEach(post => {
                if (post.comments) {
                    post.comments.forEach(comment => {
                        allComments.push({
                            ...comment,
                            postId: post.id,
                            postText: post.text
                        });
                    });
                }
            });
        }
        // Simple AI sentiment analysis
        function analyzeSentiment(text) {
            if (!text) return 'Neutral';
            const lower = text.toLowerCase();
            const posCount = positiveWords.filter(w => lower.includes(w)).length;
            const negCount = negativeWords.filter(w => lower.includes(w)).length;
            if (posCount > negCount) return 'Positive';
            if (negCount > posCount) return 'Negative';
            if (negCount > 0 || lower.includes('spam') || lower.includes('advert')) return 'Spam';
            return 'Neutral';
        }
        // Time ago function
        function timeAgo(date) {
            const now = new Date();
            const diff = now - date;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            if (days > 0) return `${days}d ago`;
            if (hours > 0) return `${hours}h ago`;
            if (minutes > 0) return `${minutes}m ago`;
            return `${seconds}s ago`;
        }
        // Delete post function
        function deletePost(postId) {
            if (confirm('Are you sure you want to delete this post?')) {
                const updatedPosts = [...posts].filter(p => p.id !== postId);
                savePosts(updatedPosts);
                logAction('post deleted by author', { id: postId }, currentUser.username, 'post');
                renderPosts();
                showNotification('Post deleted successfully');
            }
        }
        // Render posts
        function renderPosts() {
            if (!currentUser) {
                postsSection.innerHTML = `
                    <div class="no-videos">
                        <i class="fas fa-sign-in-alt fa-3x"></i>
                        <h3>Please log in to post</h3>
                        <p>Log in to share text updates and Google Drive videos with the community.</p>
                    </div>
                `;
                return;
            }
            postsSection.innerHTML = `
                <div class="post-form">
                    <form id="postForm">
                        <textarea class="post-input" id="postInput" placeholder="What's on your mind? Share a text update..." required></textarea>
                        <div class="video-upload-group">
                            <label for="driveUrl">Google Drive Share Link</label>
                            <input type="url" id="driveUrl" placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing">
                        </div>
                        <button type="submit" class="btn" style="width: 100%; justify-content: center;"><i class="fas fa-paper-plane"></i> Post Update</button>
                    </form>
                </div>
                <div id="postsList"></div>
            `;
            const postsList = document.getElementById('postsList');
            let filteredPosts = [...posts];
            if (searchQuery) {
                filteredPosts = filteredPosts.filter(post => 
                    (post.text || '').toLowerCase().includes(searchQuery) || 
                    (post.author || '').toLowerCase().includes(searchQuery)
                );
            }
            switch(currentFilter) {
                case 'recent':
                    filteredPosts = filteredPosts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                    break;
                case 'popular':
                    filteredPosts = filteredPosts.sort((a, b) => (b.views || 0) - (a.views || 0));
                    break;
                case 'liked':
                    filteredPosts = filteredPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                    break;
            }
            postsList.innerHTML = filteredPosts.map(post => {
                const isLiked = currentUser && (currentUser.sessionPostLikes || []).includes(post.id);
                let videoHtml = '';
                if (post.videoURL) {
                    videoHtml = `<div class="video-container"><iframe src="${post.videoURL}" allowfullscreen></iframe></div>`;
                }
                const deleteButton = currentUser && currentUser.username === post.author ? `
                    <button class="post-action-delete" onclick="deletePost(${post.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                ` : '';
                return `
                    <div class="post-card">
                        <div class="post-header">
                            <div class="post-author">
                                <i class="fas fa-user"></i>
                                <span>${post.author || 'Anonymous'}</span>
                            </div>
                            <div class="post-date">${new Date(post.date).toLocaleString()}</div>
                        </div>
                        <div class="post-content">
                            ${post.text ? `<p class="post-text">${preserveLineBreaks(post.text)}</p>` : ''}
                            ${videoHtml}
                        </div>
                        <div class="post-actions">
                            <button class="post-like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                                <i class="fas fa-thumbs-up"></i>
                                <span>${post.likes || 0}</span>
                            </button>
                            ${deleteButton}
                        </div>
                        <div class="comments-section" data-post-id="${post.id}">
                            <div class="comments-title">
                                <i class="fas fa-comments"></i> Comments (${(post.comments || []).length})
                            </div>
                            <form class="comment-form">
                                <input type="text" class="comment-input" placeholder="Add a comment..." required>
                                <button type="submit" class="comment-btn"><i class="fas fa-paper-plane"></i></button>
                            </form>
                            <div class="comment-list"></div>
                        </div>
                    </div>
                `;
            }).join('');
            // Post form submit
            document.getElementById('postForm').addEventListener('submit', (e) => {
                e.preventDefault();
                let text = document.getElementById('postInput').value.trim();
                const driveUrl = document.getElementById('driveUrl').value.trim();
                text = stripHtml(text); // Sanitize input to plain text
                if (!text && !driveUrl) {
                    showNotification('Please add text or Google Drive link');
                    return;
                }
                let newPost = {
                    id: Date.now(),
                    text,
                    author: currentUser.username,
                    date: new Date().toISOString(),
                    likes: 0,
                    views: 0,
                    comments: [],
                    videoType: null,
                    videoURL: null
                };
                const updatedPosts = [...posts, newPost];
                if (driveUrl) {
                    const match = driveUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
                    if (match) {
                        const id = match[1];
                        newPost.videoURL = `https://drive.google.com/file/d/${id}/preview`;
                        newPost.videoType = 'drive';
                        savePosts(updatedPosts);
                        logAction('new Google Drive video post shared', { id: newPost.id, text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), driveId: id }, currentUser.username, 'post');
                        document.getElementById('postInput').value = '';
                        document.getElementById('driveUrl').value = '';
                        showNotification('Google Drive video post shared!');
                        renderPosts();
                    } else {
                        showNotification('Invalid Google Drive link. Use share link format.');
                    }
                } else {
                    savePosts(updatedPosts);
                    logAction('new post created', { id: newPost.id, text: text.substring(0, 50) + (text.length > 50 ? '...' : '') }, currentUser.username, 'post');
                    document.getElementById('postInput').value = '';
                    showNotification('Post shared!');
                    renderPosts();
                }
            });
            // Like buttons
            postsList.querySelectorAll('.post-like-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!currentUser) return;
                    const postId = parseInt(btn.dataset.postId);
                    const post = posts.find(p => p.id === postId);
                    if (post) {
                        const isLiked = (currentUser.sessionPostLikes || []).includes(postId);
                        if (isLiked) {
                            currentUser.sessionPostLikes = currentUser.sessionPostLikes.filter(id => id !== postId);
                            post.likes = (post.likes || 0) - 1;
                        } else {
                            currentUser.sessionPostLikes = currentUser.sessionPostLikes || [];
                            currentUser.sessionPostLikes.push(postId);
                            post.likes = (post.likes || 0) + 1;
                        }
                        saveUserUpdates();
                        savePosts(posts);
                        renderPosts();
                        showNotification(isLiked ? 'Post unliked' : 'Post liked');
                    }
                });
            });
            // Setup comment listeners for posts
            postsList.querySelectorAll('.comments-section').forEach(section => {
                const postId = parseInt(section.dataset.postId);
                const post = posts.find(p => p.id === postId);
                if (post) {
                    const commentForm = section.querySelector('.comment-form');
                    const commentInput = commentForm.querySelector('.comment-input');
                    const commentList = section.querySelector('.comment-list');
                    if (commentForm && commentInput && commentList) {
                        const handleCommentSubmit = (e) => {
                            e.preventDefault();
                            if (!currentUser) {
                                showNotification('Please log in to comment');
                                return;
                            }
                            let text = commentInput.value.trim();
                            text = stripHtml(text); // Sanitize comment input to plain text
                            if (text) {
                                const newComment = {
                                    id: Date.now(),
                                    timestamp: new Date().toISOString(),
                                    username: currentUser.username,
                                    text
                                };
                                post.comments = post.comments || [];
                                post.comments.push(newComment);
                                const updatedPosts = [...posts];
                                const pIndex = updatedPosts.findIndex(p => p.id === postId);
                                if (pIndex > -1) {
                                    updatedPosts[pIndex].comments = post.comments;
                                    savePosts(updatedPosts);
                                }
                                renderCommentsForPost(post, commentList);
                                commentInput.value = '';
                                showNotification('Comment added');
                                const aiInsight = analyzeSentiment(text);
                                logAction('new post comment added', {
                                    postId: postId,
                                    comment: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                                    username: currentUser.username,
                                    aiInsight
                                }, currentUser.username, 'post-comment');
                            }
                        };
                        if (commentForm._submitHandler) commentForm.removeEventListener('submit', commentForm._submitHandler);
                        commentForm._submitHandler = handleCommentSubmit;
                        commentForm.addEventListener('submit', handleCommentSubmit);
                        renderCommentsForPost(post, commentList);
                    }
                }
            });
        }
        // Render comments for post
        function renderCommentsForPost(post, list) {
            if (!list) return;
            list.innerHTML = (post.comments || []).map(comment => {
                const deleteButton = currentUser && currentUser.username === (comment.username || '') ? `
                    <div class="comment-actions">
                        <button class="comment-action delete" onclick="deletePostComment(${post.id}, '${(comment.timestamp || '').replace(/'/g, "\\'")}')">Delete</button>
                    </div>
                ` : '';
                return `
                    <div class="comment-item">
                        <div class="comment-meta">
                            <span>${comment.username || 'Unknown'}</span>
                            <span>${new Date(comment.timestamp || Date.now()).toLocaleString()}</span>
                        </div>
                        <div class="comment-text">${preserveLineBreaks(comment.text || '')}</div>
                        ${deleteButton}
                    </div>
                `;
            }).join('');
        }
        // Delete post comment
        function deletePostComment(postId, timestamp) {
            if (confirm('Delete this comment?')) {
                const updatedPosts = [...posts];
                const postIndex = updatedPosts.findIndex(p => p.id == postId);
                if (postIndex > -1 && updatedPosts[postIndex].comments) {
                    updatedPosts[postIndex].comments = updatedPosts[postIndex].comments.filter(c => c.timestamp !== timestamp);
                    savePosts(updatedPosts);
                    logAction('delete post comment', {postId, timestamp}, currentUser.username, 'post-comment');
                    // Re-render the specific post card
                    const section = document.querySelector(`[data-post-id="${postId}"]`);
                    if (section) {
                        const commentList = section.querySelector('.comment-list');
                        if (commentList) renderCommentsForPost(updatedPosts[postIndex], commentList);
                    }
                    showNotification('Comment deleted');
                }
            }
        }
        // Start real-time listeners
        function startRealTimeListeners() {
            const usersRef = database.ref('users');
            if (usersListener) usersRef.off('value', usersListener);
            usersListener = (snapshot) => {
                const rawData = snapshot.val() || {};
                const newUsers = processUsers(rawData);
                const prevUsers = { ...users };
                // Compare for changes
                Object.keys(newUsers).forEach(email => {
                    const prevUser = prevUsers[email];
                    const user = newUsers[email];
                    if (!prevUser) {
                        // New user handled in child_added
                    } else {
                        // Check logins
                        const prevLogins = prevUser.logins?.length || 0;
                        const newLogins = user.logins?.length || 0;
                        if (newLogins > prevLogins) {
                            const loginTime = new Date(user.logins[user.logins.length - 1]).getTime();
                            let sessionDuration = null;
                            if (user.logins.length > 1) {
                                const prevTime = new Date(user.logins[user.logins.length - 2]).getTime();
                                sessionDuration = Math.round((loginTime - prevTime) / 60000); // minutes
                            }
                            let accountAge = null;
                            if (user.createdAt) {
                                const createdTime = new Date(user.createdAt).getTime();
                                accountAge = Math.round((loginTime - createdTime) / (1000 * 60 * 60 * 24)); // days
                            }
                            logAction('user login', {
                                email,
                                sessionDuration: sessionDuration ? `${sessionDuration} min` : 'first session',
                                accountAge: accountAge ? `${accountAge} days` : 'new'
                            }, email, 'user');
                        }
                        // Check session post likes
                        const prevPostLikes = prevUser.sessionPostLikes || [];
                        const newPostLikes = user.sessionPostLikes || [];
                        if (JSON.stringify(prevPostLikes) !== JSON.stringify(newPostLikes)) {
                            const addedPostLikes = newPostLikes.filter(id => !prevPostLikes.includes(id));
                            addedPostLikes.forEach(postId => {
                                logAction('user liked post', { email, postId }, email, 'post');
                            });
                        }
                    }
                });
                // Check for deleted users
                Object.keys(prevUsers).forEach(email => {
                    if (!newUsers[email]) {
                        logAction('user account deleted', { email }, 'system', 'user');
                    }
                });
                users = newUsers;
                // Update currentUser if changed
                if (currentUser && currentUser.email && users[currentUser.email]) {
                    const updatedUser = users[currentUser.email];
                    const roleChanged = currentUser.role !== updatedUser.role;
                    const usernameChanged = currentUser.username !== updatedUser.username;
                    currentUser = { ...currentUser, ...updatedUser };
                    if (roleChanged || usernameChanged) {
                        updateAuthSection();
                        updateMenu();
                        showNotification(`Your account has been updated by an admin. New role: ${currentUser.role}`);
                    }
                }
                if (currentPage === 'admin-users') renderAdminUsers(userSearch ? userSearch.value : '');
                if (currentPage === 'admin-dashboard') renderAdminDashboard();
                if (!initialLoaded.users) {
                    initialLoaded.users = true;
                    usersAddedListener = (snap) => {
                        const email = unsanitizeKey(snap.key);
                        logAction('new user registered', { email }, email, 'user');
                        database.ref(`users/${snap.key}/createdAt`).set(Date.now().toISOString());
                    };
                    usersRef.on('child_added', usersAddedListener);
                }
            };
            usersRef.on('value', usersListener);
            const postsRef = database.ref('posts');
            if (postsListener) postsRef.off('value', postsListener);
            postsListener = (snapshot) => {
                const newPosts = snapshot.val() || [];
                posts = newPosts.map(p => ({ ...p, comments: p.comments || [] }));
                if (currentPage === 'home') renderPosts();
                if (currentPage === 'admin-posts') renderAdminPosts(postSearch ? postSearch.value : '');
                if (currentPage === 'admin-dashboard') renderAdminDashboard();
                if (!initialLoaded.posts) {
                    initialLoaded.posts = true;
                    postsAddedListener = (snap) => {
                        const post = snap.val();
                        const actor = post.author || 'anonymous';
                        logAction('new post created', { id: post.id, text: post.text.substring(0, 50) + (post.text.length > 50 ? '...' : '') }, actor, 'post');
                    };
                    postsRef.on('child_added', postsAddedListener);
                }
            };
            postsRef.on('value', postsListener);
            const messagesRef = database.ref('messages');
            if (messagesListener) messagesRef.off('value', messagesListener);
            messagesListener = (snapshot) => {
                const newMessages = snapshot.val() || [];
                const prevMessages = [...messages];
                // Check for deleted messages
                prevMessages.forEach(oldM => {
                    if (!newMessages.some(nm => nm.id === oldM.id)) {
                        logAction('message deleted', { id: oldM.id }, 'system', 'message');
                    }
                });
                messages = newMessages;
                if (currentPage === 'contact') renderMessages();
                if (currentPage === 'admin-messages') renderAdminMessages(messageSearch ? messageSearch.value : '');
                if (currentPage === 'admin-dashboard') renderAdminDashboard();
                if (!initialLoaded.messages) {
                    initialLoaded.messages = true;
                    messagesAddedListener = (snap) => {
                        const msg = snap.val();
                        const actor = msg.email || 'anonymous';
                        logAction('new message received', { id: msg.id, name: msg.name || 'N/A', email: actor }, actor, 'message');
                    };
                    messagesRef.on('child_added', messagesAddedListener);
                }
            };
            messagesRef.on('value', messagesListener);
            if (logsListener) database.ref('logs').off('value', logsListener);
            logsListener = (snapshot) => {
                const data = snapshot.val() || {};
                logs = Object.values(data).map(log => ({ ...log, id: log.id || Date.now() }));
                allActors.clear();
                logs.forEach(log => allActors.add(log.actor));
                updateActorFilterOptions();
                if (currentPage === 'admin-logs') renderAdminLogs();
                if (currentPage === 'admin-dashboard') renderAdminDashboard();
            };
            database.ref('logs').on('value', logsListener);
        }
        function stopRealTimeListeners() {
            const usersRef = database.ref('users');
            if (usersListener) {
                usersRef.off('value', usersListener);
                usersListener = null;
            }
            if (usersAddedListener) {
                usersRef.off('child_added', usersAddedListener);
                usersAddedListener = null;
            }
            const postsRef = database.ref('posts');
            if (postsListener) {
                postsRef.off('value', postsListener);
                postsListener = null;
            }
            if (postsAddedListener) {
                postsRef.off('child_added', postsAddedListener);
                postsAddedListener = null;
            }
            const messagesRef = database.ref('messages');
            if (messagesListener) {
                messagesRef.off('value', messagesListener);
                messagesListener = null;
            }
            if (messagesAddedListener) {
                messagesRef.off('child_added', messagesAddedListener);
                messagesAddedListener = null;
            }
            if (logsListener) {
                database.ref('logs').off('value', logsListener);
                logsListener = null;
            }
            initialLoaded = { users: false, posts: false, messages: false };
        }
        // Save data to Firebase
        function saveUsers(usersData) {
            const sanitizedUsers = Object.fromEntries(
                Object.entries(usersData).map(([key, value]) => [sanitizeKey(key), value])
            );
            database.ref('users').set(sanitizedUsers);
        }
        function savePosts(postsData) {
            database.ref('posts').set(postsData);
        }
        function saveMessages(msgs) {
            database.ref('messages').set(msgs);
        }
        function saveLogs(logEntries) {
            database.ref('logs').set(Object.fromEntries(logEntries.map((l, i) => [i.toString(), l])));
        }
        function logAction(action, details, actor = 'system', type = 'system', providedRole = '') {
            let role = providedRole;
            if (!role) {
                role = actor === 'system' ? 'system' : (currentUser && currentUser.username === actor ? currentUser.role : getUserRole(actor) || 'guest');
            }
            const log = {
                action,
                type,
                actor,
                role,
                details,
                timestamp: new Date().toISOString()
            };
            // Add AI insight for comments
            if (type === 'post-comment' && details.comment) {
                log.aiInsight = analyzeSentiment(details.comment);
            }
            logs.push(log);
            saveLogs(logs);
            // Log alerts for system actions
            if (actor === 'system' || type === 'system') {
                let alertMsg = '';
                switch (action) {
                    case 'new user registered':
                        alertMsg = `New user registered: ${details.email}`;
                        break;
                    case 'new post created':
                        alertMsg = `New post by ${details.actor}: "${details.text}"`;
                        break;
                    case 'new message received':
                        alertMsg = `New message from ${details.name} (${details.email})`;
                        break;
                }
                if (alertMsg) {
                    showNotification(alertMsg);
                }
            }
        }
        // Load current user
        function loadCurrentUser() {
            const email = localStorage.getItem('currentUserEmail');
            if (email) {
                // Use the listener data or fetch once
                const user = users[email];
                if (user) {
                    currentUser = {...user};
                    currentUser.sessionPostLikes = currentUser.sessionPostLikes || [];
                    currentUser.logins = currentUser.logins || [];
                    currentUser.logouts = currentUser.logouts || [];
                    // Update user in database
                    const updatedUsers = {...users};
                    updatedUsers[email] = {...currentUser};
                    saveUsers(updatedUsers);
                    updateAuthSection();
                    updateMenu();
                    currentPage = 'home';
                    showPage('home');
                    showNotification(`Welcome back, ${currentUser.username}!`);
                } else {
                    currentUser = null;
                    updateAuthSection();
                    updateMenu();
                    currentPage = 'auth';
                    showPage('auth');
                }
            } else {
                currentUser = null;
                updateAuthSection();
                updateMenu();
                currentPage = 'auth';
                showPage('auth');
            }
        }
        // Toggle Sidebar
        function toggleSidebar() {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
            menuToggle.setAttribute('aria-expanded', sidebar.classList.contains('active'));
        }
        // Close Sidebar
        function closeSidebar() {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-times');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
        // Save user updates
        function saveUserUpdates() {
            if (currentUser && currentUser.email) {
                const updatedUsers = {...users};
                updatedUsers[currentUser.email] = {...currentUser};
                saveUsers(updatedUsers);
            }
        }
        // Update menu based on login status and role
        function updateMenu() {
            if (currentUser && currentUser.email) {
                sidebarTitle.textContent = `Welcome, ${currentUser.username}`;
                sidebarSubtitle.textContent = `Role: ${currentUser.role}`;
                let menuHTML = `
                    <li><a href="#" class="menu-item ${currentPage==='home'?'active':''}" data-page="home" role="menuitem" aria-label="Home"><i class="fas fa-home"></i> Home</a></li>
                    <li class="has-sub-menu-item">
                        <a href="#" class="menu-item has-sub-menu ${currentPage ==='profile' || currentPage==='profile-settings' || currentPage==='preferences'?'active':''}" data-page="profile" role="menuitem" aria-haspopup="true" aria-expanded="false" aria-label="Profile"><i class="fas fa-user"></i> Profile</a>
                        <ul class="sub-menu-list" role="menu">
                            <li><a href="#" class="menu-item sub-menu ${currentPage==='profile'?'active':''}" data-page="profile" role="menuitem" aria-label="Profile Overview"><i class="fas fa-user"></i> Profile Overview</a></li>
                            <li><a href="#" class="menu-item sub-menu ${currentPage==='profile-settings'?'active':''}" data-page="profile-settings" role="menuitem" aria-label="Account Settings"><i class="fas fa-cog"></i> Account Settings</a></li>
                            <li><a href="#" class="menu-item sub-menu ${currentPage==='preferences'?'active':''}" data-page="preferences" role="menuitem" aria-label="Preferences"><i class="fas fa-sliders-h"></i> Preferences</a></li>
                        </ul>
                    </li>
                    <li><a href="#" class="menu-item ${currentPage==='about'?'active':''}" data-page="about" role="menuitem" aria-label="About"><i class="fas fa-info-circle"></i> About</a></li>
                    <li><a href="#" class="menu-item ${currentPage==='contact'?'active':''}" data-page="contact" role="menuitem" aria-label="Contact"><i class="fas fa-envelope"></i> Contact</a></li>
                `;
                if (['moderator', 'admin', 'superadmin'].includes(currentUser.role)) {
                    const fullAdminMenu = [
                        { page: 'admin-dashboard', icon: 'fas fa-tachometer-alt', label: 'Dashboard' },
                        { page: 'admin-posts', icon: 'fas fa-video', label: 'Post Management' },
                        { page: 'admin-users', icon: 'fas fa-users', label: 'User Management' },
                        { page: 'admin-messages', icon: 'fas fa-envelope-open', label: 'Contact Messages' },
                        { page: 'admin-settings', icon: 'fas fa-cog', label: 'System Settings' },
                        { page: 'admin-logs', icon: 'fas fa-file-alt', label: 'Activity Logs' },
                        { page: 'admin-backup', icon: 'fas fa-download', label: 'Data Backup' }
                    ];
                    let allowedAdminMenu = fullAdminMenu;
                    if (currentUser.role === 'moderator') {
                        allowedAdminMenu = fullAdminMenu.filter(item => 
                            item.page === 'admin-dashboard' || 
                            item.page === 'admin-posts' ||
                            item.page === 'admin-users' || 
                            item.page === 'admin-messages'
                        );
                    } else if (currentUser.role === 'admin') {
                        allowedAdminMenu = fullAdminMenu.filter(item => 
                            item.page !== 'admin-logs' && 
                            item.page !== 'admin-backup'
                        );
                    }
                    menuHTML += `
                        <li class="has-sub-menu-item">
                            <a href="#" class="menu-item has-sub-menu ${currentPage.startsWith('admin-')?'active':''}" data-page="admin-dashboard" role="menuitem" aria-haspopup="true" aria-expanded="false" aria-label="Admin Panel"><i class="fas fa-shield-alt"></i> Admin Panel</a>
                            <ul class="sub-menu-list" role="menu">
                                ${allowedAdminMenu.map(item => `
                                    <li><a href="#" class="menu-item sub-menu ${currentPage===item.page?'active':''}" data-page="${item.page}" role="menuitem" aria-label="${item.label}"><i class="${item.icon}"></i> ${item.label}</a></li>
                                `).join('')}
                            </ul>
                        </li>
                    `;
                }
                menuList.innerHTML = menuHTML;
                sidebarLogout.style.display = 'block';
                menuToggle.classList.add('active');
            } else {
                sidebarTitle.textContent = 'StreamPlay Pro';
                sidebarSubtitle.textContent = 'Please Log In';
                menuList.innerHTML = `
                    <li><a href="#" class="menu-item ${currentPage==='auth'?'active':''}" data-page="auth" role="menuitem" aria-label="Login or Register"><i class="fas fa-sign-in-alt"></i> Login/Register</a></li>
                `;
                sidebarLogout.style.display = 'none';
                menuToggle.classList.remove('active');
                closeSidebar();
            }
            setupMenuListeners();
        }
        // Setup menu event listeners
        function setupMenuListeners() {
            menuList.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = item.getAttribute('data-page');
                    if (item.classList.contains('has-sub-menu')) {
                        toggleSubMenu(item);
                    } else {
                        navigateTo(page);
                        menuList.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                        createRippleEffect(e, item);
                        closeSidebar();
                    }
                });
                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        item.click();
                    }
                });
            });
        }
        // Toggle sub-menu
        function toggleSubMenu(menuItem) {
            const subMenu = menuItem.nextElementSibling;
            if (subMenu && subMenu.classList.contains('sub-menu-list')) {
                const isExpanded = menuItem.getAttribute('aria-expanded') === 'true';
                menuItem.setAttribute('aria-expanded', !isExpanded);
                subMenu.classList.toggle('active');
            }
        }
        // Create ripple effect
        function createRippleEffect(event, element) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = element.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size/2}px`;
            ripple.style.top = `${event.clientY - rect.top - size/2}px`;
            element.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }
        // Navigate to a page
        function navigateTo(page) {
            if (page.startsWith('admin-') && (!currentUser || !['moderator', 'admin', 'superadmin'].includes(currentUser.role))) {
                showNotification('Access denied: Admin privileges required');
                return;
            }
            if ((page === 'profile' || page === 'profile-settings' || page === 'preferences') && !currentUser) {
                showNotification('Please log in to access this page');
                return;
            }
            currentPage = page;
            showPage(page);
            updateMenu();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        // Show page
        function showPage(page) {
            document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
            const targetSection = document.getElementById(page);
            if (targetSection) {
                targetSection.classList.add('active');
                if (page === 'home') {
                    renderPosts();
                } else if (page === 'contact') {
                    renderMessages();
                } else if (page === 'profile' && currentUser) {
                    loadProfile();
                } else if (page === 'profile-settings' && currentUser) {
                    loadSettings();
                } else if (page === 'preferences' && currentUser) {
                    loadPreferences();
                } else if (page === 'admin-dashboard') {
                    renderAdminDashboard();
                } else if (page === 'admin-posts') {
                    renderAdminPosts(postSearch ? postSearch.value : '');
                } else if (page === 'admin-users') {
                    renderAdminUsers(userSearch ? userSearch.value : '');
                } else if (page === 'admin-messages') {
                    renderAdminMessages(messageSearch ? messageSearch.value : '');
                } else if (page === 'admin-settings') {
                    loadAdminSettings();
                } else if (page === 'admin-logs') {
                    renderAdminLogs();
                } else if (page === 'admin-backup') {
                    // No load needed
                }
                const firstFocusable = targetSection.querySelector('a, button, input, select, textarea');
                if (firstFocusable) firstFocusable.focus();
            }
        }
        // Render admin dashboard
        function renderAdminDashboard() {
            computeAllComments();
            const totalComments = allComments.length;
            const totalPosts = posts.length;
            const totalVideos = posts.filter(p => p.videoURL).length;
            adminStats.innerHTML = `
                <div class="stat-item">
                    <div class="stat-value">${Object.keys(users).length}</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${totalPosts}</div>
                    <div class="stat-label">Total Posts</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${totalVideos}</div>
                    <div class="stat-label">Total Videos</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${messages.length}</div>
                    <div class="stat-label">Total Messages</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${totalComments}</div>
                    <div class="stat-label">Total Comments</div>
                </div>
            `;
        }
        // Render admin posts
        function renderAdminPosts(filter = '') {
            postCount.textContent = posts.length;
            let filteredPosts = [...posts].filter(post => 
                (post.text || '').toLowerCase().includes(filter.toLowerCase()) || 
                (post.author || '').toLowerCase().includes(filter.toLowerCase())
            );
            adminPostsList.innerHTML = filteredPosts.map(post => `
                <div class="admin-item">
                    <div>
                        <strong>${post.author || 'Anonymous'}</strong> - ${new Date(post.date).toLocaleString()}<br>
                        <p>${(post.text || '').substring(0, 100)}${(post.text || '').length > 100 ? '...' : ''}</p>
                        ${post.videoURL ? '<small><i class="fas fa-video"></i> Has video</small>' : ''}
                        <br><small>Comments: ${(post.comments || []).length} | Likes: ${post.likes || 0}</small>
                    </div>
                    <div class="admin-actions">
                        <button class="admin-btn view" onclick="viewPostDetails(${post.id})">View</button>
                        <button class="admin-btn delete" onclick="deleteAdminPost(${post.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        }
        function viewPostDetails(id) {
            const post = posts.find(p => p.id === id);
            if (post) {
                const details = `Post ID: ${post.id}\nAuthor: ${post.author}\nDate: ${new Date(post.date).toLocaleString()}\nText: ${post.text}\nVideo: ${post.videoURL || 'None'}\nLikes: ${post.likes || 0}\nComments: ${JSON.stringify(post.comments || [], null, 2)}`;
                alert(details);
            }
        }
        function deleteAdminPost(id) {
            if (confirm('Are you sure you want to delete this post?')) {
                const updatedPosts = [...posts].filter(p => p.id !== id);
                savePosts(updatedPosts);
                logAction('admin deleted post', { id }, currentUser.username, 'post');
                renderAdminPosts(postSearch ? postSearch.value : '');
                if (currentPage === 'home') renderPosts();
                showNotification('Post deleted successfully');
            }
        }
        // Render admin users
        function renderAdminUsers(filter = '') {
            userCount.textContent = Object.keys(users).length;
            let filteredUsers = Object.entries(users).filter(([email]) => 
                email.toLowerCase().includes(filter.toLowerCase()) || (users[email].username || '').toLowerCase().includes(filter.toLowerCase())
            );
            const isModerator = currentUser && currentUser.role === 'moderator';
            const isAdmin = currentUser && currentUser.role === 'admin';
            const isSuperAdmin = currentUser && currentUser.role === 'superadmin';
            usersList.innerHTML = filteredUsers.map(([email, user]) => {
                let actionsHtml = '';
                actionsHtml += `<button class="admin-btn view" onclick="viewUserDetails('${email.replace(/'/g, "\\'")}')">View</button>`;
                const canEdit = (isAdmin || isSuperAdmin) && !(isAdmin && user.role === 'superadmin');
                if (canEdit) {
                    actionsHtml += `<button class="admin-btn edit" onclick="startEditForUser('${email.replace(/'/g, "\\'")}')">Edit</button>`;
                }
                if (isSuperAdmin && currentUser.email !== email) {
                    actionsHtml += `<button class="admin-btn delete" onclick="deleteAdminUser('${email.replace(/'/g, "\\'")}')">Delete</button>`;
                }
                actionsHtml = `<div class="admin-actions">${actionsHtml}</div>`;
                return `
                    <div class="admin-item">
                        <div>
                            <strong>${user.username || 'N/A'}</strong> (${email})<br>
                            <small>ID: ${user.uid || 'N/A'} | Logins: ${user.logins?.length || 0} | Posts: ${user.posts?.length || 0} | Role: ${user.role || 'user'}</small>
                        </div>
                        ${actionsHtml}
                    </div>
                `;
            }).join('');
        }
        function startEditForUser(email) {
            viewUserDetails(email);
            setTimeout(() => startEdit(), 100);
        }
        function viewUserDetails(email) {
            editingUserEmail = email;
            const user = users[email];
            if (user) {
                modalTitle.textContent = `User Details - ${user.username || 'N/A'}`;
                viewDetails.textContent = JSON.stringify(user, null, 2);
                document.getElementById('editUsername').value = user.username || '';
                document.getElementById('editPassword').value = user.password || '';
                const roleSelect = document.getElementById('editRole');
                const currentRole = user.role || 'user';
                roleSelect.value = currentRole;
                // Restrict role options based on current user role
                roleSelect.innerHTML = `
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                `;
                if (currentUser && currentUser.role !== 'superadmin') {
                    const superOption = roleSelect.querySelector('option[value="superadmin"]');
                    if (superOption) superOption.remove();
                }
                const currentEditorRole = currentUser ? currentUser.role : 'user';
                const userRole = user.role || 'user';
                if (currentEditorRole === 'moderator' || (currentEditorRole === 'admin' && userRole === 'superadmin')) {
                    roleSelect.disabled = true;
                    roleSelect.style.backgroundColor = '#ddd';
                } else {
                    roleSelect.disabled = false;
                    roleSelect.style.backgroundColor = '';
                }
                document.getElementById('editEmail').value = email;
                editUserForm.classList.remove('active');
                viewDetails.classList.remove('hidden');
                userModal.style.display = 'block';
            }
        }
        function startEdit() {
            if (currentUser && currentUser.role === 'moderator') {
                showNotification('Moderators cannot edit users');
                return;
            }
            viewDetails.classList.add('hidden');
            editUserForm.classList.add('active');
        }
        function cancelEdit() {
            viewDetails.classList.remove('hidden');
            editUserForm.classList.remove('active');
        }
        function saveUserEdit() {
            const email = document.getElementById('editEmail').value;
            const newUsername = document.getElementById('editUsername').value.trim();
            const newPassword = document.getElementById('editPassword').value.trim();
            const newRole = document.getElementById('editRole').value;
            const currentRole = users[email]?.role || 'user';
            if (users[email].role === 'superadmin' && newRole !== 'superadmin' && currentUser && currentUser.role === 'admin') {
                showNotification('Cannot change superadmin role');
                return;
            }
            if (newUsername || newPassword || newRole !== currentRole) {
                const updatedUsers = {...users};
                if (updatedUsers[email]) {
                    if (newUsername) updatedUsers[email].username = newUsername;
                    if (newPassword) updatedUsers[email].password = newPassword;
                    updatedUsers[email].role = newRole;
                    delete updatedUsers[email].isAdmin; // Clean up old field
                    updatedUsers[email].sessionPostLikes = updatedUsers[email].sessionPostLikes || [];
                    saveUsers(updatedUsers);
                    logAction('edit user', {email, changes: {username: newUsername, role: newRole}}, currentUser.username, 'user');
                    renderAdminUsers(userSearch ? userSearch.value : '');
                    showNotification('User updated');
                    userModal.style.display = 'none';
                }
            }
        }
        function deleteAdminUser(email) {
            if (!currentUser || currentUser.email === email) {
                showNotification('Cannot delete your own account');
                return;
            }
            if (currentUser && currentUser.role !== 'superadmin') {
                showNotification('Only super admins can delete users');
                return;
            }
            if (confirm(`Delete user ${email}? This action cannot be undone.`)) {
                const updatedUsers = {...users};
                delete updatedUsers[email];
                saveUsers(updatedUsers);
                logAction('delete user', {email}, currentUser.username, 'user');
                renderAdminUsers(userSearch ? userSearch.value : '');
                showNotification('User deleted successfully');
            }
        }
        // Render admin messages
        function renderAdminMessages(filter = '') {
            messageCount.textContent = messages.length;
            let filteredMessages = messages.filter(msg => 
                (msg && msg.name || '').toLowerCase().includes(filter.toLowerCase()) || (msg && msg.email || '').toLowerCase().includes(filter.toLowerCase())
            );
            messagesAdminList.innerHTML = filteredMessages.map(msg => {
                if (!msg) return '';
                const replied = msg.replied || false;
                return `
                    <div class="admin-item ${replied ? 'replied' : ''}">
                        <div>
                            <strong>${msg.name || 'N/A'}</strong> &lt;${msg.email || 'N/A'}&gt;<br>
                            <small>${new Date(msg.date || Date.now()).toLocaleString()}</small><br>
                            <p>${preserveLineBreaks(msg.message || '')}</p>
                            ${replied ? `<small><strong>Reply:</strong> ${preserveLineBreaks(msg.reply || '')} (by ${msg.repliedBy} on ${new Date(msg.repliedAt).toLocaleString()})</small>` : ''}
                        </div>
                        <div class="admin-actions">
                            ${!replied ? `
                                <button class="admin-btn reply" onclick="toggleReplyForm(${msg.id})">Reply</button>
                                <form class="reply-form" id="replyForm-${msg.id}">
                                    <textarea class="reply-textarea" placeholder="Type your reply..."></textarea>
                                    <button type="submit" class="admin-btn reply">Send Reply</button>
                                </form>
                            ` : ''}
                            <button class="admin-btn delete" onclick="deleteAdminMessage(${msg.id})">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
            filteredMessages.forEach(msg => {
                if (!msg || msg.replied) return;
                const form = document.getElementById(`replyForm-${msg.id}`);
                if (form) {
                    const handleSubmit = (e) => {
                        e.preventDefault();
                        let reply = form.querySelector('.reply-textarea').value.trim();
                        reply = stripHtml(reply); // Sanitize reply to plain text
                        if (reply) {
                            const updatedMessages = [...messages];
                            const msgIndex = updatedMessages.findIndex(m => m.id === msg.id);
                            if (msgIndex > -1) {
                                updatedMessages[msgIndex].reply = reply;
                                updatedMessages[msgIndex].replied = true;
                                updatedMessages[msgIndex].repliedBy = currentUser ? currentUser.username : 'Unknown';
                                updatedMessages[msgIndex].repliedAt = new Date().toISOString();
                                saveMessages(updatedMessages);
                                logAction('reply message', {id: msg.id}, currentUser.username, 'message');
                                showNotification('Reply sent successfully');
                            }
                        }
                    };
                    if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
                    form._submitHandler = handleSubmit;
                    form.addEventListener('submit', handleSubmit);
                }
            });
        }
        function toggleReplyForm(id) {
            const form = document.getElementById(`replyForm-${id}`);
            if (form) form.classList.toggle('active');
        }
        function deleteAdminMessage(id) {
            if (confirm('Delete this message? This action cannot be undone.')) {
                const updatedMessages = messages.filter(m => m && m.id !== id);
                saveMessages(updatedMessages);
                logAction('delete message', {id}, currentUser.username, 'message');
                renderAdminMessages(messageSearch ? messageSearch.value : '');
                showNotification('Message deleted successfully');
            }
        }
        // Load admin settings
        function loadAdminSettings() {
            database.ref('settings').once('value').then((snapshot) => {
                const settings = snapshot.val() || {};
                document.getElementById('appTitle').value = settings.title || 'StreamPlay Pro';
            });
        }
        adminSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newSettings = {
                title: document.getElementById('appTitle').value
            };
            database.ref('settings').set(newSettings);
            logAction('update settings', newSettings, currentUser.username, 'system');
            showNotification('Settings updated successfully');
        });
        function updateActorFilterOptions() {
            const actors = Array.from(allActors).sort();
            logActorFilter.innerHTML = '<option value="">All Actors</option>' + actors.map(actor => `<option value="${actor}">${actor}</option>`).join('');
        }
        function getActionType(action) {
            if (action.includes('create') || action.includes('new') || action.includes('upload') || action.includes('registered') || action.includes('received') || action.includes('login') || action.includes('liked') || action.includes('added') || action.includes('post')) return 'create';
            if (action.includes('update') || action.includes('edit') || action.includes('change') || action.includes('reply')) return 'update';
            if (action.includes('delete') || action.includes('removed')) return 'delete';
            return 'system';
        }
        function sortLogs(column) {
            if (logsSortBy === column) {
                logsSortDir = logsSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                logsSortBy = column;
                logsSortDir = 'asc';
            }
            renderAdminLogs();
        }
        function getFilteredAndSortedLogs() {
            let filtered = logs.filter(log => {
                const searchTerm = logSearch.value.toLowerCase();
                const matchesSearch = (log.action || '').toLowerCase().includes(searchTerm) || (log.actor || '').toLowerCase().includes(searchTerm);
                const matchesAction = !logActionFilter.value || getActionType(log.action) === logActionFilter.value;
                const matchesType = !logTypeFilter.value || log.type === logTypeFilter.value;
                const matchesActor = !logActorFilter.value || log.actor === logActorFilter.value;
                const matchesRole = !logRoleFilter.value || log.role === logRoleFilter.value;
                return matchesSearch && matchesAction && matchesType && matchesActor && matchesRole;
            });
            filtered.sort((a, b) => {
                let valA = a[logsSortBy] || '';
                let valB = b[logsSortBy] || '';
                if (logsSortBy === 'timestamp') {
                    valA = new Date(valA).getTime();
                    valB = new Date(valB).getTime();
                }
                if (valA < valB) return logsSortDir === 'asc' ? -1 : 1;
                if (valA > valB) return logsSortDir === 'asc' ? 1 : -1;
                return 0;
            });
            return filtered;
        }
        function renderAdminLogs() {
            logCount.textContent = logs.length;
            const filteredLogs = getFilteredAndSortedLogs();
            const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
            currentLogPage = Math.min(currentLogPage, totalPages || 1);
            const start = (currentLogPage - 1) * logsPerPage;
            const end = start + logsPerPage;
            const pageLogs = filteredLogs.slice(start, end);
            logsTableBody.innerHTML = pageLogs.map(log => {
                const actionType = getActionType(log.action);
                let aiHtml = '';
                if (log.aiInsight) {
                    aiHtml = `<div style="margin-top: 5px; padding: 5px; background: rgba(35, 214, 171, 0.1); border-radius: 3px; font-size: 0.85rem;"><strong>AI Insight:</strong> ${log.aiInsight}</div>`;
                }
                const detailsHtml = log.details ? `
                    <div class="details-summary">${JSON.stringify(log.details).substring(0, 100)}${JSON.stringify(log.details).length > 100 ? '...' : ''}</div>
                    <div class="details-full" style="display: none; margin-top: 5px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 5px;">
                        <pre>${JSON.stringify(log.details, null, 2)}</pre>
                        ${aiHtml}
                    </div>
                    <i class="fas fa-chevron-down details-toggle" onclick="toggleDetails(this)"></i>
                ` : '';
                return `
                    <tr>
                        <td class="action-cell log-action-${actionType}">${log.action || 'N/A'}</td>
                        <td class="type-cell">${log.type || 'system'}</td>
                        <td class="actor-cell">${log.actor || 'N/A'}</td>
                        <td class="role-cell">${log.role || 'N/A'}</td>
                        <td class="age-cell">${timeAgo(new Date(log.timestamp))}</td>
                        <td class="timestamp-cell">${new Date(log.timestamp || Date.now()).toLocaleString()}</td>
                        <td class="details-cell" onclick="toggleDetails(this.querySelector('.details-toggle'))">${detailsHtml}</td>
                    </tr>
                `;
            }).join('');
            renderPagination(totalPages);
        }
        function toggleDetails(icon) {
            const fullDetails = icon.parentElement.querySelector('.details-full');
            if (fullDetails) {
                fullDetails.style.display = fullDetails.style.display === 'none' ? 'block' : 'none';
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        }
        function renderPagination(totalPages) {
            if (totalPages <= 1) {
                logsPagination.innerHTML = '';
                return;
            }
            let paginationHtml = '';
            if (currentLogPage > 1) {
                paginationHtml += `<button class="pagination-btn" onclick="changeLogPage(${currentLogPage - 1})">Previous</button>`;
            }
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `<button class="pagination-btn ${i === currentLogPage ? 'active' : ''}" onclick="changeLogPage(${i})">${i}</button>`;
            }
            if (currentLogPage < totalPages) {
                paginationHtml += `<button class="pagination-btn" onclick="changeLogPage(${currentLogPage + 1})">Next</button>`;
            }
            logsPagination.innerHTML = paginationHtml;
        }
        function changeLogPage(page) {
            currentLogPage = page;
            renderAdminLogs();
        }
        function exportLogsToCSV() {
            const filteredLogs = getFilteredAndSortedLogs();
            let csv = 'Action,Type,Actor,Role,Timestamp,Details\n';
            filteredLogs.forEach(log => {
                csv += `"${log.action || 'N/A'}","${log.type || 'system'}","${log.actor || 'N/A'}","${log.role || ''}","${log.timestamp || ''}","${JSON.stringify(log.details || {})}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `streamplay-logs-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Logs exported to CSV');
        }
        function clearLogs() {
            if (confirm('Clear all logs? This action cannot be undone.')) {
                logs = [];
                saveLogs(logs);
                renderAdminLogs();
                showNotification('Logs cleared');
            }
        }
        // Backup
        backupBtn.addEventListener('click', () => {
            const data = { users, posts, messages, logs };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `streamplay-admin-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            logAction('backup data', {}, currentUser.username, 'system');
            showNotification('Full backup downloaded successfully');
        });
        // Restore
        restoreBtn.addEventListener('click', () => {
            const file = restoreFile.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        if (data.users) saveUsers(data.users);
                        if (data.posts) savePosts(data.posts);
                        if (data.messages) saveMessages(data.messages);
                        if (data.logs) saveLogs(data.logs);
                        logAction('restore data', {}, currentUser.username, 'system');
                        showNotification('Data restored successfully');
                        // Refresh current page
                        setTimeout(() => showPage(currentPage), 1000);
                    } catch (err) {
                        console.error('Restore error:', err);
                        showNotification('Invalid backup file');
                    }
                };
                reader.readAsText(file);
            } else {
                showNotification('Please select a file to restore');
            }
        });
        // Search listeners for admin
        userSearch.addEventListener('input', (e) => renderAdminUsers(e.target.value));
        messageSearch.addEventListener('input', (e) => renderAdminMessages(e.target.value));
        logSearch.addEventListener('input', () => renderAdminLogs());
        postSearch.addEventListener('input', (e) => renderAdminPosts(e.target.value));
        logActionFilter.addEventListener('change', () => renderAdminLogs());
        logTypeFilter.addEventListener('change', () => renderAdminLogs());
        logActorFilter.addEventListener('change', () => renderAdminLogs());
        logRoleFilter.addEventListener('change', () => renderAdminLogs());
        // Modal handlers
        closeModal.addEventListener('click', () => {
            userModal.style.display = 'none';
            cancelEdit();
        });
        editBtn.addEventListener('click', startEdit);
        editUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveUserEdit();
        });
        window.addEventListener('click', (e) => {
            if (e.target === userModal) {
                userModal.style.display = 'none';
                cancelEdit();
            }
        });
        // Render messages - public display to all users with replies
        function renderMessages() {
            if (messages.length === 0) {
                messagesList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No messages yet. Be the first to send one!</p>';
                return;
            }
            let displayMessages = [...messages].sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
            messagesList.innerHTML = displayMessages.map(msg => {
                if (!msg) return '';
                const replied = msg.replied || false;
                return `
                    <div class="message-item">
                        <strong>${msg.name || 'N/A'}</strong> &lt;${msg.email || 'N/A'}&gt; - ${new Date(msg.date || Date.now()).toLocaleString()}<br>
                        <p>${preserveLineBreaks(msg.message || '')}</p>
                        ${replied ? `
                            <div class="reply-section replied">
                                <strong>Reply from Admin:</strong> ${preserveLineBreaks(msg.reply || '')} - ${new Date(msg.repliedAt).toLocaleString()} (by ${msg.repliedBy})
                            </div>
                        ` : `
                            <div class="reply-section pending">
                                <strong>Status:</strong> Pending
                            </div>
                        `}
                    </div>
                `;
            }).join('');
        }
        // Load profile with login/logout times
        function loadProfile() {
            if (!currentUser || !currentUser.email) return;
            const last4Logins = currentUser.logins && currentUser.logins.length > 0 ?
                currentUser.logins.slice(-4).reverse().map(t => new Date(t).toLocaleString()).join('<br>') : 'Never';
            const last4Logouts = currentUser.logouts && currentUser.logouts.length > 0 ?
                currentUser.logouts.slice(-4).reverse().map(t => new Date(t).toLocaleString()).join('<br>') : 'Never';
            const accountAge = currentUser.createdAt ? Math.round((Date.now() - new Date(currentUser.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 'Unknown';
            profileInfo.innerHTML = `
                <div class="profile-field">
                    <label>Username</label>
                    <span>${currentUser.username}</span>
                </div>
                <div class="profile-field">
                    <label>Email</label>
                    <span>${currentUser.email}</span>
                </div>
                <div class="profile-field">
                    <label>Password</label>
                    <span>********</span>
                </div>
                <div class="profile-field">
                    <label>Role</label>
                    <span>${currentUser.role || 'user'}</span>
                </div>
                <div class="profile-field">
                    <label>Account Age</label>
                    <span>${accountAge} days</span>
                </div>
                <div class="profile-field">
                    <label>Last 4 Logins</label>
                    <span>${last4Logins}</span>
                </div>
                <div class="profile-field">
                    <label>Last 4 Logouts</label>
                    <span>${last4Logouts}</span>
                </div>
            `;
        }
        function updateAuthSection() {
            if (currentUser && currentUser.email) {
                authSection.innerHTML = `
                    <div class="user-profile">
                        <i class="fas fa-user-circle"></i>
                        <span>Hello, ${currentUser.username}</span>
                    </div>
                    <button class="logout-btn" onclick="logout()">Logout</button>
                `;
            } else {
                authSection.innerHTML = `
                    <div class="auth-section">
                        <button class="nav-btn" onclick="showPage('auth')">Login</button>
                        <button class="nav-btn" onclick="showPage('auth')">Register</button>
                    </div>
                `;
            }
        }
        function showNotification(message, type = 'success') {
            notificationText.textContent = message;
            notification.className = `notification show ${type}`;
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
        function switchForm(type) {
            loginForm.classList.remove('active');
            registerForm.classList.remove('active');
            if (type === 'login') {
                loginForm.classList.add('active');
            } else {
                registerForm.classList.add('active');
            }
        }
        function togglePassword(id) {
            const input = document.getElementById(id);
            const icon = input.nextElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.add('fa-eye');
                icon.classList.remove('fa-eye-slash');
            }
        }
        function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            if (!email || !password) {
                showNotification('Please fill in all fields');
                return;
            }
            // Fetch fresh user data from database to ensure connection
            database.ref('users').once('value').then((snapshot) => {
                const rawData = snapshot.val() || {};
                const freshUsers = processUsers(rawData);
                const user = freshUsers[email];
                if (user && user.password === password) {
                    localStorage.setItem('currentUserEmail', email);
                    currentUser = {...user};
                    currentUser.sessionPostLikes = currentUser.sessionPostLikes || [];
                    currentUser.logins = currentUser.logins || [];
                    currentUser.logouts = currentUser.logouts || [];
                    currentUser.logins.push(new Date().toISOString());
                    const updatedUsers = {...freshUsers};
                    updatedUsers[email] = {...currentUser};
                    saveUsers(updatedUsers);
                    showNotification(`Welcome back, ${user.username}!`);
                    updateAuthSection();
                    updateMenu();
                    showPage('home');
                    loginForm.reset();
                } else {
                    showNotification('Invalid email or password');
                }
            }).catch((error) => {
                console.error('Database error during login:', error);
                showNotification('Login failed due to database error. Please try again.');
            });
        }
        function handleRegister(e) {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            if (!username || !email || !password) {
                showNotification('Please fill in all fields');
                return;
            }
            // Check for existing user via database
            database.ref('users').once('value').then((snapshot) => {
                const rawData = snapshot.val() || {};
                const existingUsers = processUsers(rawData);
                if (existingUsers[email]) {
                    showNotification('User already exists with this email');
                    return;
                }
                const newUser = {
                    uid: Date.now(),
                    username,
                    email,
                    password,
                    role: username.toLowerCase() === 'admin' ? 'superadmin' : 'user',
                    sessionPostLikes: [],
                    preferences: {
                        darkMode: false,
                        notifications: true,
                        autoComments: true,
                        highQuality: false
                    },
                    logins: [new Date().toISOString()],
                    logouts: [],
                    createdAt: new Date().toISOString()
                };
                const updatedUsers = {...existingUsers};
                updatedUsers[email] = newUser;
                saveUsers(updatedUsers);
                showNotification('Account created successfully!');
                if (newUser.role === 'superadmin') showNotification('Super Admin privileges granted!');
                switchForm('login');
                registerForm.reset();
            }).catch((error) => {
                console.error('Database error during registration:', error);
                showNotification('Registration failed due to database error. Please try again.');
            });
        }
        function handleContact(e) {
            e.preventDefault();
            const name = document.getElementById('contactName').value.trim();
            const email = document.getElementById('contactEmail').value.trim();
            let message = document.getElementById('contactMessage').value.trim();
            message = stripHtml(message); // Sanitize message to plain text
            if (!name || !email || !message) {
                showNotification('Please fill in all fields');
                return;
            }
            const newMessage = {
                id: Date.now(),
                name,
                email,
                message,
                date: new Date().toISOString(),
                replied: false
            };
            const updatedMessages = [...messages, newMessage];
            saveMessages(updatedMessages);
            showNotification('Message sent successfully!');
            contactForm.reset();
            renderMessages();
        }
        function toggleTheme() {
            darkMode = !darkMode;
            localStorage.setItem('darkMode', darkMode);
            document.body.classList.toggle('dark-mode', darkMode);
            themeToggle.querySelector('i').className = darkMode ? 'fas fa-sun' : 'fas fa-moon';
            if (currentUser && currentUser.email) {
                currentUser.preferences.darkMode = darkMode;
                saveUserUpdates();
            }
            showNotification(`Theme switched to ${darkMode ? 'Dark' : 'Light'} mode`);
        }
        function updateLastUpdateTime() {
            lastUpdate.textContent = `Last update: September 30, 2025`;
        }
        function loadSettings() {
            if (!currentUser || !currentUser.email) return;
            document.getElementById('newEmail').value = '';
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        }
        function handleSettings(e) {
            e.preventDefault();
            if (!currentUser || !currentUser.email) return;
            const newEmail = document.getElementById('newEmail').value.trim();
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (oldPassword !== currentUser.password) {
                showNotification('Old password incorrect');
                return;
            }
            if (newPassword && newPassword !== confirmPassword) {
                showNotification('Passwords do not match');
                return;
            }
            if (newEmail && newEmail !== currentUser.email) {
                // Handle email change logic if needed
                showNotification('Email change not implemented yet');
                return;
            }
            if (newPassword) {
                currentUser.password = newPassword;
            }
            saveUserUpdates();
            logAction('update user password', {email: currentUser.email}, currentUser.username, 'user');
            showNotification('Settings updated successfully');
            settingsForm.reset();
        }
        function loadPreferences() {
            if (!currentUser || !currentUser.email || !currentUser.preferences) return;
            const prefs = currentUser.preferences;
            document.getElementById('prefDarkMode').checked = prefs.darkMode || false;
            document.getElementById('prefNotifications').checked = prefs.notifications || false;
            document.getElementById('prefAutoComments').checked = prefs.autoComments || false;
            document.getElementById('prefHighQuality').checked = prefs.highQuality || false;
            // Sync with global
            darkMode = prefs.darkMode || false;
            if (darkMode) {
                document.body.classList.add('dark-mode');
                themeToggle.querySelector('i').className = 'fas fa-sun';
            }
        }
        function savePreferences() {
            if (!currentUser || !currentUser.email) return;
            const newPrefs = {
                darkMode: document.getElementById('prefDarkMode').checked,
                notifications: document.getElementById('prefNotifications').checked,
                autoComments: document.getElementById('prefAutoComments').checked,
                highQuality: document.getElementById('prefHighQuality').checked
            };
            currentUser.preferences = newPrefs;
            darkMode = newPrefs.darkMode;
            localStorage.setItem('darkMode', darkMode);
            document.body.classList.toggle('dark-mode', darkMode);
            themeToggle.querySelector('i').className = darkMode ? 'fas fa-sun' : 'fas fa-moon';
            saveUserUpdates();
            logAction('update preferences', newPrefs, currentUser.username, 'user');
            showNotification('Preferences saved');
        }
        function deleteAccount() {
            if (confirm('Delete your account? This cannot be undone.')) {
                if (!currentUser || !currentUser.email) return;
                const updatedUsers = {...users};
                delete updatedUsers[currentUser.email];
                saveUsers(updatedUsers);
                localStorage.removeItem('currentUserEmail');
                currentUser = null;
                updateAuthSection();
                updateMenu();
                showPage('auth');
                showNotification('Account deleted');
                logAction('delete user account', {email: currentUser.email}, currentUser.username, 'user');
            }
        }
        function logout() {
            if (currentUser && currentUser.email) {
                currentUser.logouts = currentUser.logouts || [];
                currentUser.logouts.push(new Date().toISOString());
                saveUserUpdates();
                localStorage.removeItem('currentUserEmail');
                currentUser = null;
                updateAuthSection();
                updateMenu();
                showPage('auth');
                showNotification('Logged out successfully');
                logAction('user logout', {email: currentUser.email}, currentUser.username, 'user');
            }
        }
        function setupEventListeners() {
            // Menu toggle
            menuToggle.addEventListener('click', toggleSidebar);
            sidebarOverlay.addEventListener('click', closeSidebar);
            // Theme toggle
            themeToggle.addEventListener('click', toggleTheme);
            // Refresh button
            document.getElementById('refreshBtn').addEventListener('click', () => {
                renderPosts();
                showNotification('Feed refreshed!');
            });
            // Search and filter
            document.getElementById('searchInput').addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase().trim();
                renderPosts();
            });
            document.getElementById('filterSelect').addEventListener('change', (e) => {
                currentFilter = e.target.value;
                localStorage.setItem('currentFilter', currentFilter);
                renderPosts();
            });
            // Settings form
            settingsForm.addEventListener('submit', handleSettings);
            // Delete account
            deleteAccountBtn.addEventListener('click', deleteAccount);
            // Save preferences
            savePreferencesBtn.addEventListener('click', savePreferences);
            // Login and register forms
            loginForm.addEventListener('submit', handleLogin);
            registerForm.addEventListener('submit', handleRegister);
            contactForm.addEventListener('submit', handleContact);
            // Admin settings already handled above
        }
        // Initialize app
        function initApp() {
            startRealTimeListeners();
            Promise.all([
                new Promise(resolve => database.ref('posts').once('value').then(snapshot => {
                    posts = snapshot.val() || [];
                    resolve();
                })),
                new Promise(resolve => database.ref('users').once('value').then(snapshot => {
                    users = processUsers(snapshot.val() || {});
                    resolve();
                })),
                new Promise(resolve => database.ref('messages').once('value').then(snapshot => {
                    messages = snapshot.val() || [];
                    resolve();
                })),
                new Promise(resolve => database.ref('logs').once('value').then(snapshot => {
                    const data = snapshot.val() || {};
                    logs = Object.values(data);
                    resolve();
                }))
            ]).then(() => {
                loadCurrentUser();
                // Load theme preference
                darkMode = JSON.parse(localStorage.getItem('darkMode')) || false;
                if (darkMode) {
                    document.body.classList.add('dark-mode');
                    themeToggle.querySelector('i').className = 'fas fa-sun';
                }
                currentFilter = localStorage.getItem('currentFilter') || 'all';
                document.getElementById('filterSelect').value = currentFilter;
                setupEventListeners();
                updateLastUpdateTime();
            });
        }
        // Cleanup on unload
        window.addEventListener('beforeunload', stopRealTimeListeners);
        initApp();
    