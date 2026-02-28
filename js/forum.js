/**
 * Forum Logic for NewKet
 * Handles categories, topics, and posts with Supabase integration.
 */

document.addEventListener('DOMContentLoaded', () => {
    const categoriesList = document.getElementById('categoriesList');
    const topicsGrid = document.getElementById('topicsGrid');
    const currentCategoryName = document.getElementById('currentCategoryName');
    const newTopicBtn = document.getElementById('newTopicBtn');
    const newTopicModal = document.getElementById('newTopicModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const closeModalOverlay = document.getElementById('closeModalOverlay');
    const cancelBtn = document.getElementById('cancelBtn');
    const newTopicForm = document.getElementById('newTopicForm');
    const topicCategorySelect = document.getElementById('topicCategory');

    let categories = [];
    let currentCategoryId = null;

    // Initialize Forum
    const initForum = async () => {
        await loadCategories();
        await loadTopics();
        setupEventListeners();
    };

    // Load Categories from Supabase
    const loadCategories = async () => {
        try {
            const { data, error } = await window.supabaseClient
                .from('forum_categories')
                .select('*')
                .order('name');

            if (error) throw error;

            categories = data;
            renderCategories();
            renderCategorySelect();
        } catch (err) {
            console.error('Error loading forum categories:', err);
            // Fallback UI
            categoriesList.innerHTML = '<p class="text-xs text-red-500">Erreur lors du chargement des catégories.</p>';
        }
    };

    // Render Categories in Sidebar
    const renderCategories = () => {
        categoriesList.innerHTML = `
            <button class="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${!currentCategoryId ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}" 
                onclick="window.forumManager.filterByCategory(null)">
                Toutes les discussions
            </button>
        `;

        categories.forEach(cat => {
            const isActive = currentCategoryId === cat.id;
            categoriesList.innerHTML += `
                <button class="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}" 
                    onclick="window.forumManager.filterByCategory('${cat.id}')">
                    <div class="flex items-center gap-3">
                        <iconify-icon icon="${cat.icon || 'solar:chat-round-line-linear'}" width="18"></iconify-icon>
                        ${cat.name}
                    </div>
                </button>
            `;
        });
    };

    // Load Topics from Supabase
    const loadTopics = async (categoryId = null) => {
        topicsGrid.innerHTML = `
            <div class="animate-pulse space-y-4">
                <div class="h-32 bg-white rounded-3xl"></div>
                <div class="h-32 bg-white rounded-3xl"></div>
            </div>
        `;

        try {
            let query = window.supabaseClient
                .from('forum_topics')
                .select(`
                    *,
                    users (name, avatar),
                    forum_posts (count)
                `)
                .order('created_at', { ascending: false });

            if (categoryId) {
                query = query.eq('category_id', categoryId);
            }

            const { data, error } = await query;

            if (error) throw error;

            renderTopics(data);
        } catch (err) {
            console.error('Error loading forum topics:', err);
            topicsGrid.innerHTML = `
                <div class="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
                    <iconify-icon icon="solar:shield-warning-linear" width="48" class="text-gray-300 mb-4"></iconify-icon>
                    <p class="text-gray-500">Impossible de charger les discussions. Vérifiez votre connexion.</p>
                </div>
            `;
        }
    };

    // Render Topics List
    const renderTopics = (topics) => {
        if (!topics || topics.length === 0) {
            topicsGrid.innerHTML = `
                <div class="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
                    <iconify-icon icon="solar:chat-square-line-linear" width="48" class="text-gray-300 mb-4"></iconify-icon>
                    <p class="text-gray-500">Aucune discussion dans cette catégorie pour le moment.</p>
                </div>
            `;
            return;
        }

        topicsGrid.innerHTML = topics.map(topic => {
            const date = new Date(topic.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long'
            });

            return `
                <div class="forum-card bg-white p-6 rounded-3xl border border-gray-100 shadow-sm cursor-pointer group" onclick="window.forumManager.viewTopic('${topic.id}')">
                    <div class="flex gap-4">
                        <div class="shrink-0">
                            <img src="${topic.users?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + topic.user_id}" 
                                class="w-12 h-12 rounded-full border-2 border-slate-50 shadow-sm object-cover">
                        </div>
                        <div class="flex-1">
                            <div class="flex items-start justify-between mb-1">
                                <h3 class="text-lg font-bold text-gray-900 group-hover:text-black transition-colors leading-tight">
                                    ${topic.title}
                                </h3>
                                <div class="flex items-center gap-1.5 text-gray-400">
                                    <iconify-icon icon="solar:chat-round-dots-linear" width="18"></iconify-icon>
                                    <span class="text-sm font-bold">${topic.forum_posts[0].count}</span>
                                </div>
                            </div>
                            <p class="text-gray-500 text-sm line-clamp-2 mb-4">
                                ${topic.content}
                            </p>
                            <div class="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                <span class="text-gray-900">${topic.users?.name || 'Utilisateur'}</span>
                                <span class="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <span>${date}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Render Category Select in Modal
    const renderCategorySelect = () => {
        topicCategorySelect.innerHTML = categories.map(cat => `
            <option value="${cat.id}">${cat.name}</option>
        `).join('');
    };

    // Event Listeners Setup
    const setupEventListeners = () => {
        newTopicBtn.addEventListener('click', () => {
            if (!window.AuthManager.getRole()) {
                window.location.href = 'login.html?redirect=forum.html';
                return;
            }
            newTopicModal.classList.remove('hidden');
        });

        const closeModal = () => newTopicModal.classList.add('hidden');
        closeModalBtn.addEventListener('click', closeModal);
        closeModalOverlay.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        newTopicForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createTopic();
        });
    };

    // Create Topic in Supabase
    const createTopic = async () => {
        const title = document.getElementById('topicTitle').value;
        const content = document.getElementById('topicContent').value;
        const categoryId = topicCategorySelect.value;

        const user = (await window.supabaseClient.auth.getUser()).data.user;

        if (!user) {
            alert('Vous devez être connecté pour publier.');
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('forum_topics')
                .insert([{
                    title,
                    content,
                    category_id: categoryId,
                    user_id: user.id
                }]);

            if (error) throw error;

            alert('Discussion publiée avec succès !');
            newTopicModal.classList.add('hidden');
            newTopicForm.reset();
            loadTopics(currentCategoryId);
        } catch (err) {
            console.error('Error creating topic:', err);
            alert('Erreur lors de la publication. Réessayez.');
        }
    };

    // Global Manager Object for onclick events
    window.forumManager = {
        filterByCategory: (id) => {
            currentCategoryId = id;
            const category = categories.find(c => c.id === id);
            currentCategoryName.textContent = category ? category.name : 'Toutes les discussions';
            renderCategories();
            loadTopics(id);
        },
        viewTopic: async (id) => {
            currentTopicId = id;
            document.getElementById('topicsContainer').classList.add('hidden');
            document.getElementById('topicDetailContainer').classList.remove('hidden');
            window.scrollTo(0, 0);

            await loadTopicDetails(id);
            await loadPosts(id);
        },
        backToTopics: () => {
            currentTopicId = null;
            document.getElementById('topicsContainer').classList.remove('hidden');
            document.getElementById('topicDetailContainer').classList.add('hidden');
        }
    };

    // Load Single Topic Details
    const loadTopicDetails = async (topicId) => {
        const headerSection = document.getElementById('topicHeaderSection');
        headerSection.innerHTML = '<div class="animate-pulse h-24 bg-gray-50 rounded-2xl"></div>';

        try {
            const { data, error } = await window.supabaseClient
                .from('forum_topics')
                .select('*, users(name, avatar), forum_categories(name)')
                .eq('id', topicId)
                .single();

            if (error) throw error;

            const date = new Date(data.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            headerSection.innerHTML = `
                <div class="flex items-center gap-2 mb-4">
                    <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        ${data.forum_categories.name}
                    </span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">${data.title}</h1>
                <div class="flex items-center gap-4 py-6 border-t border-gray-50">
                    <img src="${data.users?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + data.user_id}" 
                        class="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover">
                    <div>
                        <div class="font-bold text-gray-900">${data.users?.name || 'Utilisateur'}</div>
                        <div class="text-xs text-gray-400 font-medium">${date}</div>
                    </div>
                </div>
                <div class="mt-6 text-gray-700 leading-relaxed whitespace-pre-wrap">
                    ${data.content}
                </div>
            `;
        } catch (err) {
            console.error('Error loading topic details:', err);
        }
    };

    // Load Posts/Replies for a topic
    const loadPosts = async (topicId) => {
        const postsList = document.getElementById('postsList');
        postsList.innerHTML = '';

        try {
            const { data, error } = await window.supabaseClient
                .from('forum_posts')
                .select('*, users(name, avatar)')
                .eq('topic_id', topicId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data.length === 0) {
                postsList.innerHTML = `
                    <div class="text-center py-10 text-gray-400 text-sm">
                        Aucune réponse pour le moment. Soyez le premier à répondre !
                    </div>
                `;
                return;
            }

            postsList.innerHTML = data.map(post => {
                const date = new Date(post.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return `
                    <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <div class="flex items-start gap-4">
                            <img src="${post.users?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + post.user_id}" 
                                class="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover">
                            <div class="flex-1">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-bold text-gray-900 text-sm">${post.users?.name || 'Utilisateur'}</span>
                                    <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${date}</span>
                                </div>
                                <div class="text-gray-700 text-sm whitespace-pre-wrap">
                                    ${post.content}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error loading posts:', err);
        }
    };

    // Handle Replies
    document.getElementById('replyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('replyContent').value;
        const user = (await window.supabaseClient.auth.getUser()).data.user;

        if (!user) {
            alert('Vous devez être connecté pour répondre.');
            window.location.href = 'login.html?redirect=forum.html';
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('forum_posts')
                .insert([{
                    content,
                    topic_id: currentTopicId,
                    user_id: user.id
                }]);

            if (error) throw error;

            document.getElementById('replyContent').value = '';
            await loadPosts(currentTopicId);
        } catch (err) {
            console.error('Error posting reply:', err);
            alert('Erreur lors de la réponse.');
        }
    });

    initForum();
});
