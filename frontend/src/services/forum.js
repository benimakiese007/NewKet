/**
 * Forum Logic for NewKet
 * Handles categories, topics, and posts with Supabase integration.
 */
import { escapeHTML } from './sanitize.js';

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
    const categoryChips = document.getElementById('categoryChips');
    const forumSearchInput = document.getElementById('forumSearch');

    let categories = [];
    let currentCategoryId = null;
    let currentTopicId = null;

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
        const allDiscussionsHtml = `
            <button class="group w-full text-left px-5 py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-wider transition-all ${!currentCategoryId ? 'bg-black text-white dark:bg-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800'}" 
                onclick="window.forumManager.filterByCategory(null)">
                <div class="flex items-center justify-between">
                    <span>Toutes les discussions</span>
                    <iconify-icon icon="solar:globus-linear" class="${!currentCategoryId ? 'block' : 'hidden'}"></iconify-icon>
                </div>
            </button>
        `;

        const categoriesHtml = categories.map(cat => {
            const isActive = currentCategoryId === cat.id;
            return `
                <button class="group w-full text-left px-5 py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-wider transition-all ${isActive ? 'bg-black text-white dark:bg-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800'}" 
                    onclick="window.forumManager.filterByCategory('${escapeHTML(cat.id)}')">
                    <div class="flex items-center gap-3">
                        <iconify-icon icon="${escapeHTML(cat.icon || 'solar:chat-round-line-linear')}" width="20" class="${isActive ? 'text-white dark:text-black' : 'text-gray-400 group-hover:text-black dark:group-hover:text-white'}"></iconify-icon>
                        <span class="flex-1">${escapeHTML(cat.name)}</span>
                    </div>
                </button>
            `;
        }).join('');

        categoriesList.innerHTML = allDiscussionsHtml + categoriesHtml;
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
                    users (name, avatar, company_name),
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

    // Perform Search
    const performSearch = async (queryText) => {
        topicsGrid.innerHTML = `
            <div class="animate-pulse space-y-4">
                <div class="h-32 bg-gray-50 dark:bg-zinc-800 rounded-3xl"></div>
                <div class="h-32 bg-gray-50 dark:bg-zinc-800 rounded-3xl"></div>
            </div>
        `;

        try {
            const { data, error } = await window.supabaseClient
                .from('forum_topics')
                .select('*, users(name, avatar, company_name), forum_posts(count)')
                .or(`title.ilike.%${queryText}%,content.ilike.%${queryText}%`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            renderTopics(data);
        } catch (err) {
            console.error('Error during search:', err);
        }
    };

    // Render Topics List
    const renderTopics = (topics) => {
        const topicCountEl = document.getElementById('topicCount');
        if (topicCountEl) topicCountEl.textContent = topics ? topics.length : 0;

        if (!topics || topics.length === 0) {
            topicsGrid.innerHTML = `
                <div class="bg-white dark:bg-zinc-900 p-16 rounded-[40px] text-center border border-dashed border-gray-200 dark:border-zinc-800">
                    <div class="w-20 h-20 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <iconify-icon icon="solar:chat-square-line-linear" width="40" class="text-gray-300 dark:text-zinc-600"></iconify-icon>
                    </div>
                    <h3 class="text-xl font-bold mb-2">Pas encore de discussion</h3>
                    <p class="text-gray-500 dark:text-zinc-400">Soyez le premier à lancer le débat dans cette catégorie !</p>
                </div>
            `;
            return;
        }

        topicsGrid.innerHTML = topics.map((topic, index) => {
            const date = new Date(topic.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long'
            });
            const avatarSrc = escapeHTML(topic.users?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + topic.user_id);
            const postCount = topic.forum_posts?.[0]?.count || 0;

            return `
                <div class="forum-card group bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-gray-100 dark:border-zinc-800 cursor-pointer shadow-sm hover:shadow-xl transition-all animate-fade-in-up" 
                    style="animation-delay: ${index * 80}ms"
                    onclick="window.forumManager.viewTopic('${escapeHTML(topic.id)}')">
                    <div class="flex flex-col sm:flex-row gap-6">
                        <div class="shrink-0">
                            <div class="relative">
                                <img src="${avatarSrc}" 
                                    class="w-14 h-14 rounded-full border-4 border-gray-50 dark:border-zinc-800 shadow-sm object-cover group-hover:scale-110 transition-transform duration-500">
                                <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></div>
                            </div>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-start justify-between mb-2">
                                <h3 class="text-xl font-black text-gray-900 dark:text-white group-hover:text-black dark:group-hover:text-zinc-200 transition-colors leading-tight tracking-tight">
                                    ${escapeHTML(topic.title)}
                                </h3>
                                <div class="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-zinc-800 rounded-2xl text-gray-400 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-all">
                                    <iconify-icon icon="solar:chat-round-dots-bold" width="18"></iconify-icon>
                                    <span class="text-sm font-black">${escapeHTML(postCount)}</span>
                                </div>
                            </div>
                            <p class="text-gray-500 dark:text-zinc-400 text-base line-clamp-2 mb-6 font-medium leading-relaxed">
                                ${escapeHTML(topic.content)}
                            </p>
                            <div class="flex flex-wrap items-center gap-6 text-[11px] font-black uppercase tracking-[0.15em]">
                                <div class="flex items-center gap-2">
                                    <span class="text-gray-900 dark:text-white">${escapeHTML(topic.users?.company_name || topic.users?.name || 'Utilisateur')}</span>
                                </div>
                                <div class="flex items-center gap-2 text-gray-400">
                                    <iconify-icon icon="solar:calendar-linear" width="14"></iconify-icon>
                                    <span>${escapeHTML(date)}</span>
                                </div>
                                <div class="sm:hidden flex items-center gap-1.5 text-gray-400">
                                    <iconify-icon icon="solar:chat-round-dots-linear" width="14"></iconify-icon>
                                    <span class="font-bold">${escapeHTML(postCount)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Render Category Chips in Modal
    const renderCategorySelect = () => {
        if (!categoryChips || !topicCategorySelect) return;
        
        categoryChips.innerHTML = categories.map(cat => `
            <button type="button" 
                data-id="${cat.id}"
                class="category-chip px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 hover:border-black dark:hover:border-white transition-all">
                ${escapeHTML(cat.name)}
            </button>
        `).join('');

        // Selection Logic
        const chips = categoryChips.querySelectorAll('.category-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black', 'border-black', 'dark:border-white'));
                chip.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black', 'border-black', 'dark:border-white');
                topicCategorySelect.value = chip.dataset.id;
            });
        });

        // Auto-select first if none selected
        if (categories.length > 0 && !topicCategorySelect.value) {
            chips[0].click();
        }
    };


    // Event Listeners Setup
    const setupEventListeners = () => {
        const mobileNewTopicBtn = document.getElementById('mobileNewTopicBtn');
        const openModal = () => {
            if (!window.AuthManager.getRole()) {
                window.location.href = '/pages/login?redirect=forum';
                return;
            }
            newTopicModal.classList.remove('hidden');
            newTopicModal.classList.add('flex');
            renderCategorySelect();
        };

        newTopicBtn.addEventListener('click', openModal);
        if (mobileNewTopicBtn) mobileNewTopicBtn.addEventListener('click', openModal);

        // Search Debounce
        let searchTimeout;
        if (forumSearchInput) {
            forumSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim().toLowerCase();
                searchTimeout = setTimeout(() => {
                    if (query.length > 2) {
                        performSearch(query);
                    } else if (query.length === 0) {
                        loadTopics(currentCategoryId);
                    }
                }, 400);
            });
        }

        const closeModal = () => {
            newTopicModal.classList.add('hidden');
            newTopicModal.classList.remove('flex');
        };
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
            newTopicModal.classList.remove('flex');
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
            const topicDetailContainer = document.getElementById('topicDetailContainer');
            topicDetailContainer.classList.remove('hidden');
            topicDetailContainer.classList.add('animate-fade-in-up');
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
        headerSection.innerHTML = '<div class="animate-pulse h-40 bg-gray-50 dark:bg-zinc-800 rounded-[32px]"></div>';

        try {
            const { data, error } = await window.supabaseClient
                .from('forum_topics')
                .select('*, users(name, avatar, company_name), forum_categories(name, icon)')
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

            const detailAvatar = escapeHTML(data.users?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + data.user_id);
            headerSection.innerHTML = `
                <div class="flex items-center gap-2 mb-6">
                    <span class="flex items-center gap-2 px-4 py-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                        <iconify-icon icon="${escapeHTML(data.forum_categories.icon || 'solar:hashtag-square-linear')}"></iconify-icon>
                        ${escapeHTML(data.forum_categories.name)}
                    </span>
                </div>
                <h1 class="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white mb-8 tracking-tighter leading-tight">${escapeHTML(data.title)}</h1>
                
                <div class="flex items-center gap-4 py-8 border-t border-gray-50 dark:border-zinc-800">
                    <img src="${detailAvatar}" 
                        class="w-14 h-14 rounded-full border-4 border-gray-50 dark:border-zinc-800 shadow-sm object-cover">
                    <div>
                        <div class="font-black text-gray-900 dark:text-white text-lg">${escapeHTML(data.users?.company_name || data.users?.name || 'Utilisateur')}</div>
                        <div class="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                            <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
                            ${escapeHTML(date)}
                        </div>
                    </div>
                </div>

                <div class="mt-8 text-gray-700 dark:text-zinc-300 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                    ${escapeHTML(data.content)}
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
                .select('*, users(name, avatar, company_name)')
                .eq('topic_id', topicId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data.length === 0) {
                postsList.innerHTML = `
                    <div class="text-center py-20 text-gray-400 dark:text-zinc-600 font-bold uppercase tracking-widest text-xs">
                        Aucune réponse pour le moment
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
                const postAvatar = escapeHTML(post.users?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + post.user_id);

                return `
                    <div class="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-start gap-6">
                            <div class="shrink-0">
                                <img src="${postAvatar}" 
                                    class="w-12 h-12 rounded-full border-2 border-gray-50 dark:border-zinc-800 shadow-sm object-cover">
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center justify-between mb-3">
                                    <div class="flex items-center gap-2">
                                        <span class="font-black text-gray-900 dark:text-white text-base">${escapeHTML(post.users?.company_name || post.users?.name || 'Utilisateur')}</span>
                                        <iconify-icon icon="solar:verified-check-bold" class="text-black dark:text-white" width="16"></iconify-icon>
                                    </div>
                                    <span class="text-[10px] text-gray-400 dark:text-zinc-500 font-black uppercase tracking-widest">${escapeHTML(date)}</span>
                                </div>
                                <div class="text-gray-700 dark:text-zinc-300 text-base font-medium leading-relaxed whitespace-pre-wrap">
                                    ${escapeHTML(post.content)}
                                </div>
                                <div class="mt-6 flex items-center gap-4">
                                    <button class="interaction-btn flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black dark:hover:text-white">
                                        <iconify-icon icon="solar:like-linear" width="16"></iconify-icon>
                                        Utile
                                    </button>
                                    <button class="interaction-btn flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black dark:hover:text-white">
                                        <iconify-icon icon="solar:share-linear" width="16"></iconify-icon>
                                        Partager
                                    </button>
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
    replyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = replyContent.value.trim();
            const submitBtn = replyForm.querySelector('button[type="submit"]');

            if (!content || !currentTopicId) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon>';

            try {
                const { error } = await window.supabaseClient
                    .from('forum_posts')
                    .insert([{
                        topic_id: currentTopicId,
                        user_id: window.AuthManager.getUserId(),
                        content
                    }]);

                if (error) throw error;

                replyContent.value = '';
                await loadPosts(currentTopicId);
                
                // Success Feedback
                submitBtn.classList.remove('bg-black', 'dark:bg-white');
                submitBtn.classList.add('bg-green-500', 'text-white');
                submitBtn.innerHTML = '<iconify-icon icon="solar:check-circle-bold" width="20"></iconify-icon>';
                
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('bg-green-500', 'text-white');
                    submitBtn.classList.add('bg-black', 'dark:bg-white');
                    submitBtn.innerHTML = 'Répondre';
                }, 2000);

            } catch (err) {
                console.error('Error posting reply:', err);
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Erreur';
            }
        });

    initForum();
});
