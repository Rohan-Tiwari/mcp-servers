// Question bank: 100 most frequently asked coding interview questions globally
// Sources: LeetCode Top Interview, FAANG, Glassdoor, levels.fyi patterns

export const QUESTIONS = [
  // ─── ARRAYS ───────────────────────────────────────────────────────────
  {
    id: 1,
    title: "Two Sum",
    category: "Arrays",
    difficulty: "Easy",
    companies: ["Amazon", "Google", "Apple", "Microsoft"],
    description:
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] = 2 + 7 = 9" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    tags: ["Hash Table", "Array"],
    frequency: 98,
  },
  {
    id: 2,
    title: "Best Time to Buy and Sell Stock",
    category: "Arrays",
    difficulty: "Easy",
    companies: ["Amazon", "Bloomberg", "Facebook"],
    description:
      "You are given an array `prices` where `prices[i]` is the price of a given stock on the i-th day.\n\nFind the maximum profit you can achieve from one buy-sell transaction. If no profit is possible, return 0.",
    examples: [
      { input: "prices = [7,1,5,3,6,4]", output: "5", explanation: "Buy on day 2 (price=1), sell on day 5 (price=6), profit = 5" },
      { input: "prices = [7,6,4,3,1]", output: "0" },
    ],
    tags: ["Array", "Sliding Window"],
    frequency: 95,
  },
  {
    id: 3,
    title: "Contains Duplicate",
    category: "Arrays",
    difficulty: "Easy",
    companies: ["Amazon", "Apple"],
    description:
      "Given an integer array `nums`, return `true` if any value appears at least twice, and `false` if every element is distinct.",
    examples: [
      { input: "nums = [1,2,3,1]", output: "true" },
      { input: "nums = [1,2,3,4]", output: "false" },
    ],
    tags: ["Array", "Hash Table", "Sorting"],
    frequency: 87,
  },
  {
    id: 4,
    title: "Product of Array Except Self",
    category: "Arrays",
    difficulty: "Medium",
    companies: ["Amazon", "Apple", "Facebook", "Microsoft"],
    description:
      "Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all the elements of `nums` except `nums[i]`.\n\nYou must not use the division operation and must run in O(n) time.",
    examples: [
      { input: "nums = [1,2,3,4]", output: "[24,12,8,6]" },
      { input: "nums = [-1,1,0,-3,3]", output: "[0,0,9,0,0]" },
    ],
    tags: ["Array", "Prefix Sum"],
    frequency: 89,
  },
  {
    id: 5,
    title: "Maximum Subarray (Kadane's Algorithm)",
    category: "Arrays",
    difficulty: "Medium",
    companies: ["Amazon", "Apple", "Google", "Microsoft"],
    description:
      "Given an integer array `nums`, find the subarray with the largest sum and return its sum.",
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6", explanation: "[4,-1,2,1] has the largest sum = 6" },
      { input: "nums = [1]", output: "1" },
    ],
    tags: ["Array", "Dynamic Programming", "Divide and Conquer"],
    frequency: 91,
  },
  {
    id: 6,
    title: "Maximum Product Subarray",
    category: "Arrays",
    difficulty: "Medium",
    companies: ["Amazon", "LinkedIn"],
    description:
      "Given an integer array `nums`, find a subarray that has the largest product and return the product.",
    examples: [
      { input: "nums = [2,3,-2,4]", output: "6", explanation: "[2,3] has the largest product = 6" },
      { input: "nums = [-2,0,-1]", output: "0" },
    ],
    tags: ["Array", "Dynamic Programming"],
    frequency: 82,
  },
  {
    id: 7,
    title: "Find Minimum in Rotated Sorted Array",
    category: "Arrays",
    difficulty: "Medium",
    companies: ["Amazon", "Microsoft"],
    description:
      "Given a sorted rotated array of unique integers, find the minimum element. You must write an algorithm that runs in O(log n) time.",
    examples: [
      { input: "nums = [3,4,5,1,2]", output: "1" },
      { input: "nums = [4,5,6,7,0,1,2]", output: "0" },
    ],
    tags: ["Array", "Binary Search"],
    frequency: 83,
  },
  {
    id: 8,
    title: "Search in Rotated Sorted Array",
    category: "Arrays",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Bloomberg"],
    description:
      "Given a rotated sorted array and a `target`, return the index of `target` or -1 if not found. Must run in O(log n) time.",
    examples: [
      { input: "nums = [4,5,6,7,0,1,2], target = 0", output: "4" },
      { input: "nums = [4,5,6,7,0,1,2], target = 3", output: "-1" },
    ],
    tags: ["Array", "Binary Search"],
    frequency: 86,
  },
  {
    id: 9,
    title: "3Sum",
    category: "Arrays",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Google", "Adobe"],
    description:
      "Given an integer array `nums`, return all the triplets [nums[i], nums[j], nums[k]] such that i ≠ j ≠ k and nums[i] + nums[j] + nums[k] == 0. The solution set must not contain duplicate triplets.",
    examples: [
      { input: "nums = [-1,0,1,2,-1,-4]", output: "[[-1,-1,2],[-1,0,1]]" },
      { input: "nums = [0,0,0]", output: "[[0,0,0]]" },
    ],
    tags: ["Array", "Two Pointers", "Sorting"],
    frequency: 88,
  },
  {
    id: 10,
    title: "Container With Most Water",
    category: "Arrays",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg", "Goldman Sachs"],
    description:
      "Given an integer array `height` of length n, find two lines that form a container holding the most water. Return the maximum amount of water the container can store.",
    examples: [
      { input: "height = [1,8,6,2,5,4,8,3,7]", output: "49" },
      { input: "height = [1,1]", output: "1" },
    ],
    tags: ["Array", "Two Pointers", "Greedy"],
    frequency: 85,
  },

  // ─── STRINGS ──────────────────────────────────────────────────────────
  {
    id: 11,
    title: "Valid Anagram",
    category: "Strings",
    difficulty: "Easy",
    companies: ["Amazon", "Google", "Uber"],
    description:
      "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.",
    examples: [
      { input: 's = "anagram", t = "nagaram"', output: "true" },
      { input: 's = "rat", t = "car"', output: "false" },
    ],
    tags: ["Hash Table", "String", "Sorting"],
    frequency: 85,
  },
  {
    id: 12,
    title: "Group Anagrams",
    category: "Strings",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Uber", "Microsoft"],
    description:
      "Given an array of strings `strs`, group the anagrams together. You can return the answer in any order.",
    examples: [
      { input: 'strs = ["eat","tea","tan","ate","nat","bat"]', output: '[["bat"],["nat","tan"],["ate","eat","tea"]]' },
    ],
    tags: ["Hash Table", "String", "Sorting"],
    frequency: 88,
  },
  {
    id: 13,
    title: "Valid Palindrome",
    category: "Strings",
    difficulty: "Easy",
    companies: ["Facebook", "Amazon", "Uber"],
    description:
      "A phrase is a palindrome if, after converting all uppercase letters to lowercase and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string `s`, return `true` if it is a palindrome, or `false` otherwise.",
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: "true" },
      { input: 's = "race a car"', output: "false" },
    ],
    tags: ["Two Pointers", "String"],
    frequency: 86,
  },
  {
    id: 14,
    title: "Longest Substring Without Repeating Characters",
    category: "Strings",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg", "Facebook", "TikTok"],
    description:
      "Given a string `s`, find the length of the longest substring without repeating characters.",
    examples: [
      { input: 's = "abcabcbb"', output: "3", explanation: "The answer is 'abc', with the length of 3." },
      { input: 's = "bbbbb"', output: "1" },
    ],
    tags: ["Hash Table", "String", "Sliding Window"],
    frequency: 94,
  },
  {
    id: 15,
    title: "Longest Repeating Character Replacement",
    category: "Strings",
    difficulty: "Medium",
    companies: ["Google", "Facebook"],
    description:
      "You are given a string `s` and an integer `k`. You can choose any character and change it to any other character at most `k` times. Return the length of the longest substring containing the same letter you can get after performing the operations.",
    examples: [
      { input: 's = "ABAB", k = 2', output: "4" },
      { input: 's = "AABABBA", k = 1', output: "4" },
    ],
    tags: ["Hash Table", "String", "Sliding Window"],
    frequency: 80,
  },
  {
    id: 16,
    title: "Minimum Window Substring",
    category: "Strings",
    difficulty: "Hard",
    companies: ["Amazon", "Facebook", "Google", "Snapchat"],
    description:
      "Given two strings `s` and `t`, return the minimum window substring of `s` such that every character in `t` (including duplicates) is included in the window. If no window exists, return `\"\"`.",
    examples: [
      { input: 's = "ADOBECODEBANC", t = "ABC"', output: '"BANC"' },
      { input: 's = "a", t = "a"', output: '"a"' },
    ],
    tags: ["Hash Table", "String", "Sliding Window", "Two Pointers"],
    frequency: 85,
  },
  {
    id: 17,
    title: "Valid Parentheses",
    category: "Strings",
    difficulty: "Easy",
    companies: ["Amazon", "Google", "Facebook", "Bloomberg"],
    description:
      "Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid. An input string is valid if brackets are closed in the correct order.",
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "()[]{}"', output: "true" },
      { input: 's = "(]"', output: "false" },
    ],
    tags: ["String", "Stack"],
    frequency: 90,
  },
  {
    id: 18,
    title: "Encode and Decode Strings",
    category: "Strings",
    difficulty: "Medium",
    companies: ["Google", "Facebook"],
    description:
      "Design an algorithm to encode a list of strings to a single string and decode it back to the original list. The encoded string is sent over the network and is decoded back to the original list of strings.",
    examples: [
      { input: '["lint","code","love","you"]', output: '["lint","code","love","you"]', explanation: "Encode then decode back" },
    ],
    tags: ["String", "Design"],
    frequency: 78,
  },

  // ─── LINKED LISTS ─────────────────────────────────────────────────────
  {
    id: 19,
    title: "Reverse a Linked List",
    category: "Linked Lists",
    difficulty: "Easy",
    companies: ["Amazon", "Apple", "Google", "Adobe"],
    description:
      "Given the head of a singly linked list, reverse the list, and return the reversed list.",
    examples: [
      { input: "head = [1,2,3,4,5]", output: "[5,4,3,2,1]" },
      { input: "head = [1,2]", output: "[2,1]" },
    ],
    tags: ["Linked List", "Recursion"],
    frequency: 93,
  },
  {
    id: 20,
    title: "Merge Two Sorted Lists",
    category: "Linked Lists",
    difficulty: "Easy",
    companies: ["Amazon", "Microsoft", "Google"],
    description:
      "You are given the heads of two sorted linked lists `list1` and `list2`. Merge the two lists into one sorted list and return the head of the merged list.",
    examples: [
      { input: "list1 = [1,2,4], list2 = [1,3,4]", output: "[1,1,2,3,4,4]" },
      { input: "list1 = [], list2 = []", output: "[]" },
    ],
    tags: ["Linked List", "Recursion"],
    frequency: 88,
  },
  {
    id: 21,
    title: "Reorder List",
    category: "Linked Lists",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook"],
    description:
      "Given the head of a singly linked list L: L0 → L1 → … → Ln-1 → Ln, reorder it to: L0 → Ln → L1 → Ln-1 → L2 → Ln-2 → …\n\nYou may not modify the values in the nodes, only the node's pointers.",
    examples: [
      { input: "head = [1,2,3,4]", output: "[1,4,2,3]" },
      { input: "head = [1,2,3,4,5]", output: "[1,5,2,4,3]" },
    ],
    tags: ["Linked List", "Two Pointers", "Recursion"],
    frequency: 79,
  },
  {
    id: 22,
    title: "Remove Nth Node From End of List",
    category: "Linked Lists",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Microsoft"],
    description:
      "Given the head of a linked list, remove the nth node from the end of the list and return its head.",
    examples: [
      { input: "head = [1,2,3,4,5], n = 2", output: "[1,2,3,5]" },
      { input: "head = [1], n = 1", output: "[]" },
    ],
    tags: ["Linked List", "Two Pointers"],
    frequency: 84,
  },
  {
    id: 23,
    title: "Detect Cycle in a Linked List",
    category: "Linked Lists",
    difficulty: "Easy",
    companies: ["Amazon", "Bloomberg", "Microsoft"],
    description:
      "Given the head of a linked list, determine if the linked list has a cycle in it. Return `true` if there is a cycle, otherwise `false`.",
    examples: [
      { input: "head = [3,2,0,-4], pos = 1", output: "true", explanation: "Tail connects to node at index 1" },
      { input: "head = [1,2], pos = -1", output: "false" },
    ],
    tags: ["Hash Table", "Linked List", "Two Pointers"],
    frequency: 87,
  },
  {
    id: 24,
    title: "LRU Cache",
    category: "Linked Lists",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Google", "Microsoft"],
    description:
      "Design a data structure that follows the Least Recently Used (LRU) cache constraints.\n\nImplement the `LRUCache` class with `get(key)` and `put(key, value)` methods that both run in O(1) average time complexity.",
    examples: [
      {
        input: 'LRUCache(2), put(1,1), put(2,2), get(1) → 1, put(3,3), get(2) → -1, put(4,4), get(1) → -1, get(3) → 3, get(4) → 4',
        output: "[null,null,null,1,null,-1,null,-1,3,4]",
      },
    ],
    tags: ["Hash Table", "Linked List", "Design", "Doubly-Linked List"],
    frequency: 90,
  },
  {
    id: 25,
    title: "Merge K Sorted Lists",
    category: "Linked Lists",
    difficulty: "Hard",
    companies: ["Amazon", "Facebook", "Google", "Uber"],
    description:
      "You are given an array of `k` linked-lists, each sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.",
    examples: [
      { input: "lists = [[1,4,5],[1,3,4],[2,6]]", output: "[1,1,2,3,4,4,5,6]" },
      { input: "lists = []", output: "[]" },
    ],
    tags: ["Linked List", "Divide and Conquer", "Heap", "Merge Sort"],
    frequency: 87,
  },

  // ─── TREES ────────────────────────────────────────────────────────────
  {
    id: 26,
    title: "Invert Binary Tree",
    category: "Trees",
    difficulty: "Easy",
    companies: ["Amazon", "Google", "Apple"],
    description:
      "Given the root of a binary tree, invert the tree, and return its root.",
    examples: [
      { input: "root = [4,2,7,1,3,6,9]", output: "[4,7,2,9,6,3,1]" },
      { input: "root = [2,1,3]", output: "[2,3,1]" },
    ],
    tags: ["Tree", "DFS", "BFS", "Binary Tree"],
    frequency: 87,
  },
  {
    id: 27,
    title: "Maximum Depth of Binary Tree",
    category: "Trees",
    difficulty: "Easy",
    companies: ["Amazon", "LinkedIn"],
    description:
      "Given the root of a binary tree, return its maximum depth — the number of nodes along the longest path from root to a leaf node.",
    examples: [
      { input: "root = [3,9,20,null,null,15,7]", output: "3" },
      { input: "root = [1,null,2]", output: "2" },
    ],
    tags: ["Tree", "DFS", "BFS", "Binary Tree"],
    frequency: 88,
  },
  {
    id: 28,
    title: "Same Tree",
    category: "Trees",
    difficulty: "Easy",
    companies: ["Amazon", "Bloomberg"],
    description:
      "Given the roots of two binary trees `p` and `q`, write a function to check if they are the same. Two binary trees are considered the same if they are structurally identical, and the nodes have the same value.",
    examples: [
      { input: "p = [1,2,3], q = [1,2,3]", output: "true" },
      { input: "p = [1,2], q = [1,null,2]", output: "false" },
    ],
    tags: ["Tree", "DFS", "BFS", "Binary Tree"],
    frequency: 82,
  },
  {
    id: 29,
    title: "Subtree of Another Tree",
    category: "Trees",
    difficulty: "Easy",
    companies: ["Amazon", "Facebook"],
    description:
      "Given the roots of two binary trees `root` and `subRoot`, return `true` if there is a subtree of `root` with the same structure and node values as `subRoot`.",
    examples: [
      { input: "root = [3,4,5,1,2], subRoot = [4,1,2]", output: "true" },
      { input: "root = [3,4,5,1,2,null,null,null,null,0], subRoot = [4,1,2]", output: "false" },
    ],
    tags: ["Tree", "DFS", "Binary Tree", "String Matching"],
    frequency: 80,
  },
  {
    id: 30,
    title: "Lowest Common Ancestor of a BST",
    category: "Trees",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Microsoft"],
    description:
      "Given a binary search tree (BST), find the lowest common ancestor (LCA) node of two given nodes `p` and `q`.",
    examples: [
      { input: "root = [6,2,8,0,4,7,9,null,null,3,5], p = 2, q = 8", output: "6" },
      { input: "root = [6,2,8,0,4,7,9,null,null,3,5], p = 2, q = 4", output: "2" },
    ],
    tags: ["Tree", "DFS", "BST", "Binary Tree"],
    frequency: 84,
  },
  {
    id: 31,
    title: "Binary Tree Level Order Traversal",
    category: "Trees",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Microsoft", "Uber"],
    description:
      "Given the root of a binary tree, return the level order traversal of its nodes' values (i.e., from left to right, level by level).",
    examples: [
      { input: "root = [3,9,20,null,null,15,7]", output: "[[3],[9,20],[15,7]]" },
      { input: "root = [1]", output: "[[1]]" },
    ],
    tags: ["Tree", "BFS", "Binary Tree"],
    frequency: 88,
  },
  {
    id: 32,
    title: "Validate Binary Search Tree",
    category: "Trees",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg", "Facebook"],
    description:
      "Given the root of a binary tree, determine if it is a valid binary search tree (BST).",
    examples: [
      { input: "root = [2,1,3]", output: "true" },
      { input: "root = [5,1,4,null,null,3,6]", output: "false" },
    ],
    tags: ["Tree", "DFS", "BST", "Binary Tree"],
    frequency: 86,
  },
  {
    id: 33,
    title: "Kth Smallest Element in a BST",
    category: "Trees",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg"],
    description:
      "Given the root of a binary search tree, and an integer `k`, return the kth smallest value (1-indexed) of all the values of the nodes in the tree.",
    examples: [
      { input: "root = [3,1,4,null,2], k = 1", output: "1" },
      { input: "root = [5,3,6,2,4,null,null,1], k = 3", output: "3" },
    ],
    tags: ["Tree", "DFS", "BST", "Binary Tree"],
    frequency: 82,
  },
  {
    id: 34,
    title: "Construct Binary Tree from Preorder and Inorder Traversal",
    category: "Trees",
    difficulty: "Medium",
    companies: ["Amazon", "Microsoft"],
    description:
      "Given two integer arrays `preorder` and `inorder` where `preorder` is the preorder traversal and `inorder` is the inorder traversal of the same tree, construct and return the binary tree.",
    examples: [
      { input: "preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]", output: "[3,9,20,null,null,15,7]" },
    ],
    tags: ["Array", "Hash Table", "Divide and Conquer", "Tree", "DFS"],
    frequency: 81,
  },
  {
    id: 35,
    title: "Binary Tree Maximum Path Sum",
    category: "Trees",
    difficulty: "Hard",
    companies: ["Amazon", "Facebook", "Uber"],
    description:
      "A path in a binary tree is a sequence of nodes where each pair of adjacent nodes has an edge. A node can only appear once. The path does not need to pass through the root.\n\nReturn the maximum path sum.",
    examples: [
      { input: "root = [1,2,3]", output: "6", explanation: "Optimal path: 2 → 1 → 3" },
      { input: "root = [-10,9,20,null,null,15,7]", output: "42", explanation: "Optimal path: 15 → 20 → 7" },
    ],
    tags: ["Tree", "DFS", "Binary Tree", "Dynamic Programming"],
    frequency: 83,
  },

  // ─── GRAPHS ───────────────────────────────────────────────────────────
  {
    id: 36,
    title: "Number of Islands",
    category: "Graphs",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Google", "Bloomberg"],
    description:
      "Given an m×n 2D grid of `'1'`s (land) and `'0'`s (water), count the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.",
    examples: [
      { input: 'grid = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]', output: "1" },
      { input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]', output: "3" },
    ],
    tags: ["Array", "DFS", "BFS", "Matrix", "Union Find"],
    frequency: 93,
  },
  {
    id: 37,
    title: "Clone Graph",
    category: "Graphs",
    difficulty: "Medium",
    companies: ["Facebook", "Amazon", "Google"],
    description:
      "Given a reference of a node in a connected undirected graph, return a deep copy (clone) of the graph. Each node contains a value and a list of its neighbors.",
    examples: [
      { input: "adjList = [[2,4],[1,3],[2,4],[1,3]]", output: "[[2,4],[1,3],[2,4],[1,3]]" },
    ],
    tags: ["Hash Table", "DFS", "BFS", "Graph"],
    frequency: 82,
  },
  {
    id: 38,
    title: "Pacific Atlantic Water Flow",
    category: "Graphs",
    difficulty: "Medium",
    companies: ["Facebook", "Amazon"],
    description:
      "Given an m×n rectangular island that borders both the Pacific and Atlantic oceans, find all cells that can flow to both oceans. Water can flow to a neighbor if the neighbor's height ≤ current cell's height.",
    examples: [
      { input: "heights = [[1,2,2,3,5],[3,2,3,4,4],[2,4,5,3,1],[6,7,1,4,5],[5,1,1,2,4]]", output: "[[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]]" },
    ],
    tags: ["Array", "DFS", "BFS", "Matrix"],
    frequency: 79,
  },
  {
    id: 39,
    title: "Course Schedule (Cycle Detection)",
    category: "Graphs",
    difficulty: "Medium",
    companies: ["Facebook", "Uber", "Zenefits"],
    description:
      "There are `numCourses` courses to take labeled 0 to numCourses-1. Given an array `prerequisites`, where prerequisites[i] = [a,b] means you must take course b first, determine if it's possible to finish all courses.",
    examples: [
      { input: "numCourses = 2, prerequisites = [[1,0]]", output: "true" },
      { input: "numCourses = 2, prerequisites = [[1,0],[0,1]]", output: "false" },
    ],
    tags: ["DFS", "BFS", "Graph", "Topological Sort"],
    frequency: 88,
  },
  {
    id: 40,
    title: "Number of Connected Components in an Undirected Graph",
    category: "Graphs",
    difficulty: "Medium",
    companies: ["LinkedIn", "Facebook", "Google"],
    description:
      "Given `n` nodes labeled 0 to n-1 and a list of undirected edges, return the number of connected components in the graph.",
    examples: [
      { input: "n = 5, edges = [[0,1],[1,2],[3,4]]", output: "2" },
      { input: "n = 5, edges = [[0,1],[1,2],[2,3],[3,4]]", output: "1" },
    ],
    tags: ["DFS", "BFS", "Union Find", "Graph"],
    frequency: 82,
  },

  // ─── DYNAMIC PROGRAMMING ──────────────────────────────────────────────
  {
    id: 41,
    title: "Climbing Stairs",
    category: "Dynamic Programming",
    difficulty: "Easy",
    companies: ["Amazon", "Google", "Adobe", "Apple"],
    description:
      "You are climbing a staircase. It takes `n` steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    examples: [
      { input: "n = 2", output: "2", explanation: "1+1, 2" },
      { input: "n = 3", output: "3", explanation: "1+1+1, 1+2, 2+1" },
    ],
    tags: ["Math", "Dynamic Programming", "Memoization"],
    frequency: 91,
  },
  {
    id: 42,
    title: "Coin Change",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Apple", "Google", "Microsoft"],
    description:
      "Given an integer array `coins` representing different coin denominations and an integer `amount`, return the fewest number of coins needed to make up that amount. Return -1 if it's not possible.",
    examples: [
      { input: "coins = [1,5,10,25], amount = 30", output: "2", explanation: "25 + 5" },
      { input: "coins = [2], amount = 3", output: "-1" },
    ],
    tags: ["Array", "Dynamic Programming", "BFS"],
    frequency: 88,
  },
  {
    id: 43,
    title: "Longest Increasing Subsequence",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Microsoft", "Google"],
    description:
      "Given an integer array `nums`, return the length of the longest strictly increasing subsequence.",
    examples: [
      { input: "nums = [10,9,2,5,3,7,101,18]", output: "4", explanation: "[2,3,7,101]" },
      { input: "nums = [0,1,0,3,2,3]", output: "4" },
    ],
    tags: ["Array", "Binary Search", "Dynamic Programming"],
    frequency: 85,
  },
  {
    id: 44,
    title: "Longest Common Subsequence",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Google", "Bloomberg"],
    description:
      "Given two strings `text1` and `text2`, return the length of their longest common subsequence. If there is no common subsequence, return 0.",
    examples: [
      { input: 'text1 = "abcde", text2 = "ace"', output: "3", explanation: 'LCS is "ace"' },
      { input: 'text1 = "abc", text2 = "abc"', output: "3" },
    ],
    tags: ["String", "Dynamic Programming"],
    frequency: 83,
  },
  {
    id: 45,
    title: "Word Break",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Google", "Apple"],
    description:
      "Given a string `s` and a dictionary of strings `wordDict`, return `true` if `s` can be segmented into a space-separated sequence of one or more dictionary words.",
    examples: [
      { input: 's = "leetcode", wordDict = ["leet","code"]', output: "true" },
      { input: 's = "catsandog", wordDict = ["cats","dog","sand","and","cat"]', output: "false" },
    ],
    tags: ["Hash Table", "String", "Dynamic Programming", "Trie", "Memoization"],
    frequency: 86,
  },
  {
    id: 46,
    title: "Combination Sum IV",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Facebook", "Amazon"],
    description:
      "Given an array of distinct integers `nums` and a target integer `target`, return the number of possible combinations that add up to `target`. The order of numbers in the combination matters.",
    examples: [
      { input: "nums = [1,2,3], target = 4", output: "7" },
      { input: "nums = [9], target = 3", output: "0" },
    ],
    tags: ["Array", "Dynamic Programming"],
    frequency: 79,
  },
  {
    id: 47,
    title: "House Robber",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Airbnb"],
    description:
      "You are a robber planning to rob houses along a street. Adjacent houses have security systems connected — you cannot rob two adjacent houses. Given an integer array `nums`, return the maximum amount you can rob tonight.",
    examples: [
      { input: "nums = [1,2,3,1]", output: "4", explanation: "Rob house 1 (money=1) then house 3 (money=3)" },
      { input: "nums = [2,7,9,3,1]", output: "12" },
    ],
    tags: ["Array", "Dynamic Programming"],
    frequency: 88,
  },
  {
    id: 48,
    title: "House Robber II",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Airbnb"],
    description:
      "All houses are arranged in a circle. You cannot rob two adjacent houses and the first/last houses are adjacent. Return the maximum amount you can rob.",
    examples: [
      { input: "nums = [2,3,2]", output: "3" },
      { input: "nums = [1,2,3,1]", output: "4" },
    ],
    tags: ["Array", "Dynamic Programming"],
    frequency: 81,
  },
  {
    id: 49,
    title: "Decode Ways",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook"],
    description:
      "A string containing digits can be decoded using a mapping (1→A, 2→B, …, 26→Z). Given a string `s`, return the number of ways to decode it.",
    examples: [
      { input: 's = "12"', output: "2", explanation: '"AB" (1 2) or "L" (12)' },
      { input: 's = "226"', output: "3" },
    ],
    tags: ["String", "Dynamic Programming"],
    frequency: 84,
  },
  {
    id: 50,
    title: "0/1 Knapsack Problem",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Google", "Goldman Sachs"],
    description:
      "Given `n` items each with a weight and value, and a knapsack capacity `W`, find the maximum total value you can put in the knapsack. Each item can only be picked once.",
    examples: [
      { input: "weights = [1,3,4,5], values = [1,4,5,7], W = 7", output: "9" },
    ],
    tags: ["Array", "Dynamic Programming"],
    frequency: 87,
  },

  // ─── BINARY SEARCH ────────────────────────────────────────────────────
  {
    id: 51,
    title: "Binary Search",
    category: "Binary Search",
    difficulty: "Easy",
    companies: ["Amazon", "Google", "Bloomberg"],
    description:
      "Given an array of integers `nums` sorted in ascending order and a `target`, return the index of `target` or -1 if not found. Must run in O(log n) time.",
    examples: [
      { input: "nums = [-1,0,3,5,9,12], target = 9", output: "4" },
      { input: "nums = [-1,0,3,5,9,12], target = 2", output: "-1" },
    ],
    tags: ["Array", "Binary Search"],
    frequency: 90,
  },
  {
    id: 52,
    title: "Find Peak Element",
    category: "Binary Search",
    difficulty: "Medium",
    companies: ["Google", "Microsoft", "Facebook"],
    description:
      "A peak element is strictly greater than its neighbors. Given a 0-indexed integer array `nums`, find a peak element and return its index. You must write O(log n) time.",
    examples: [
      { input: "nums = [1,2,3,1]", output: "2" },
      { input: "nums = [1,2,1,3,5,6,4]", output: "1 or 5" },
    ],
    tags: ["Array", "Binary Search", "Divide and Conquer"],
    frequency: 82,
  },
  {
    id: 53,
    title: "Koko Eating Bananas",
    category: "Binary Search",
    difficulty: "Medium",
    companies: ["Karat", "Amazon"],
    description:
      "Given piles of bananas and `h` hours to eat all of them, find the minimum eating speed `k` such that she can finish all the bananas within `h` hours.",
    examples: [
      { input: "piles = [3,6,7,11], h = 8", output: "4" },
      { input: "piles = [30,11,23,4,20], h = 5", output: "30" },
    ],
    tags: ["Array", "Binary Search"],
    frequency: 79,
  },

  // ─── HEAP / PRIORITY QUEUE ────────────────────────────────────────────
  {
    id: 54,
    title: "Find Median from Data Stream",
    category: "Heap",
    difficulty: "Hard",
    companies: ["Amazon", "Google", "Microsoft"],
    description:
      "Design a data structure that supports adding integers and finding the median. Implement `MedianFinder` with `addNum(num)` and `findMedian()` methods.",
    examples: [
      { input: "addNum(1), addNum(2), findMedian() → 1.5, addNum(3), findMedian() → 2.0", output: "[null,null,1.5,null,2.0]" },
    ],
    tags: ["Two Pointers", "Design", "Sorting", "Heap"],
    frequency: 84,
  },
  {
    id: 55,
    title: "Top K Frequent Elements",
    category: "Heap",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Yelp"],
    description:
      "Given an integer array `nums` and an integer `k`, return the `k` most frequent elements.",
    examples: [
      { input: "nums = [1,1,1,2,2,3], k = 2", output: "[1,2]" },
      { input: "nums = [1], k = 1", output: "[1]" },
    ],
    tags: ["Array", "Hash Table", "Divide and Conquer", "Sorting", "Heap", "Bucket Sort"],
    frequency: 87,
  },
  {
    id: 56,
    title: "K Closest Points to Origin",
    category: "Heap",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Asana"],
    description:
      "Given an array of points where `points[i] = [xi, yi]`, return the `k` closest points to the origin `(0, 0)`.",
    examples: [
      { input: "points = [[1,3],[-2,2]], k = 1", output: "[[-2,2]]" },
      { input: "points = [[3,3],[5,-1],[-2,4]], k = 2", output: "[[3,3],[-2,4]]" },
    ],
    tags: ["Array", "Math", "Divide and Conquer", "Geometry", "Sorting", "Heap"],
    frequency: 83,
  },
  {
    id: 57,
    title: "Task Scheduler",
    category: "Heap",
    difficulty: "Medium",
    companies: ["Facebook", "Apple"],
    description:
      "Given a characters array `tasks` (CPU tasks) and an integer `n` (cooldown period), find the minimum number of intervals the CPU will take to finish all tasks.",
    examples: [
      { input: 'tasks = ["A","A","A","B","B","B"], n = 2', output: "8" },
      { input: 'tasks = ["A","A","A","B","B","B"], n = 0', output: "6" },
    ],
    tags: ["Array", "Hash Table", "Greedy", "Sorting", "Heap", "Counting"],
    frequency: 80,
  },

  // ─── BACKTRACKING ─────────────────────────────────────────────────────
  {
    id: 58,
    title: "Subsets",
    category: "Backtracking",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Bloomberg"],
    description:
      "Given an integer array `nums` of unique elements, return all possible subsets (the power set). The solution set must not contain duplicate subsets.",
    examples: [
      { input: "nums = [1,2,3]", output: "[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]" },
      { input: "nums = [0]", output: "[[],[0]]" },
    ],
    tags: ["Array", "Backtracking", "Bit Manipulation"],
    frequency: 85,
  },
  {
    id: 59,
    title: "Combination Sum",
    category: "Backtracking",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook"],
    description:
      "Given an array of distinct integers `candidates` and a `target`, return all unique combinations of candidates that sum to `target`. You may use the same number any number of times.",
    examples: [
      { input: "candidates = [2,3,6,7], target = 7", output: "[[2,2,3],[7]]" },
    ],
    tags: ["Array", "Backtracking"],
    frequency: 83,
  },
  {
    id: 60,
    title: "Permutations",
    category: "Backtracking",
    difficulty: "Medium",
    companies: ["Amazon", "Microsoft", "Lyft"],
    description:
      "Given an array `nums` of distinct integers, return all the possible permutations.",
    examples: [
      { input: "nums = [1,2,3]", output: "[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]" },
      { input: "nums = [0,1]", output: "[[0,1],[1,0]]" },
    ],
    tags: ["Array", "Backtracking"],
    frequency: 86,
  },
  {
    id: 61,
    title: "Word Search",
    category: "Backtracking",
    difficulty: "Medium",
    companies: ["Amazon", "Facebook", "Bloomberg"],
    description:
      "Given an m×n grid and a string `word`, return `true` if the word exists in the grid. The word can be constructed from letters of sequentially adjacent cells (horizontally/vertically). A cell may not be reused.",
    examples: [
      { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCCED"', output: "true" },
      { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "SEE"', output: "true" },
    ],
    tags: ["Array", "Backtracking", "Matrix"],
    frequency: 82,
  },
  {
    id: 62,
    title: "N-Queens",
    category: "Backtracking",
    difficulty: "Hard",
    companies: ["Amazon", "Bloomberg"],
    description:
      "The n-queens puzzle is the problem of placing `n` queens on an n×n chessboard such that no two queens attack each other. Return all distinct solutions.",
    examples: [
      { input: "n = 4", output: '[[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]' },
      { input: "n = 1", output: '[[\"Q\"]]' },
    ],
    tags: ["Array", "Backtracking"],
    frequency: 80,
  },

  // ─── TRIES ────────────────────────────────────────────────────────────
  {
    id: 63,
    title: "Implement Trie (Prefix Tree)",
    category: "Tries",
    difficulty: "Medium",
    companies: ["Google", "Amazon", "Microsoft"],
    description:
      "Implement a trie with `insert`, `search`, and `startsWith` methods.\n\n- `insert(word)` inserts the string into the trie.\n- `search(word)` returns true if word is in the trie.\n- `startsWith(prefix)` returns true if there is any word in the trie that starts with the given prefix.",
    examples: [
      { input: 'insert("apple"), search("apple") → true, search("app") → false, startsWith("app") → true', output: "[null,true,false,true]" },
    ],
    tags: ["Hash Table", "String", "Design", "Trie"],
    frequency: 85,
  },
  {
    id: 64,
    title: "Design Add and Search Words Data Structure",
    category: "Tries",
    difficulty: "Medium",
    companies: ["Facebook", "LinkedIn"],
    description:
      "Design a data structure that supports adding new words and searching for a string that may contain dots `.` as a wildcard for any letter.",
    examples: [
      { input: 'addWord("bad"), addWord("dad"), addWord("mad"), search("pad") → false, search("bad") → true, search(".ad") → true, search("b..") → true', output: "[null,null,null,false,true,true,true]" },
    ],
    tags: ["String", "Depth-First Search", "Design", "Trie"],
    frequency: 80,
  },
  {
    id: 65,
    title: "Word Search II",
    category: "Tries",
    difficulty: "Hard",
    companies: ["Amazon", "Google", "Airbnb"],
    description:
      "Given an m×n board of characters and a list of strings `words`, return all words on the board. Each word must be constructed from letters of sequentially adjacent cells.",
    examples: [
      { input: 'board = [["o","a","a","n"],["e","t","a","e"],["i","h","k","r"],["i","f","l","v"]], words = ["oath","pea","eat","rain"]', output: '["eat","oath"]' },
    ],
    tags: ["Array", "String", "Backtracking", "Trie", "Matrix"],
    frequency: 78,
  },

  // ─── SORTING & SEARCHING ──────────────────────────────────────────────
  {
    id: 66,
    title: "Sort an Array (Merge Sort)",
    category: "Sorting",
    difficulty: "Medium",
    companies: ["Amazon", "Google"],
    description:
      "Given an array of integers `nums`, sort the array in ascending order using Merge Sort. Your algorithm must be O(n log n) without built-in sort functions.",
    examples: [
      { input: "nums = [5,1,1,2,0,0]", output: "[0,0,1,1,2,5]" },
      { input: "nums = [5,2,3,1]", output: "[1,2,3,5]" },
    ],
    tags: ["Array", "Divide and Conquer", "Sorting", "Merge Sort"],
    frequency: 82,
  },
  {
    id: 67,
    title: "Quick Select (Kth Largest Element)",
    category: "Sorting",
    difficulty: "Medium",
    companies: ["Facebook", "Amazon", "Google"],
    description:
      "Given an integer array `nums` and an integer `k`, return the kth largest element in the array. You must solve it without sorting.",
    examples: [
      { input: "nums = [3,2,1,5,6,4], k = 2", output: "5" },
      { input: "nums = [3,2,3,1,2,4,5,5,6], k = 4", output: "4" },
    ],
    tags: ["Array", "Divide and Conquer", "Sorting", "Heap", "Quick Select"],
    frequency: 87,
  },

  // ─── TWO POINTERS & SLIDING WINDOW ────────────────────────────────────
  {
    id: 68,
    title: "Move Zeroes",
    category: "Two Pointers",
    difficulty: "Easy",
    companies: ["Facebook", "Bloomberg", "Lyft"],
    description:
      "Given an integer array `nums`, move all `0`s to the end while maintaining the relative order of the non-zero elements. Must do it in-place.",
    examples: [
      { input: "nums = [0,1,0,3,12]", output: "[1,3,12,0,0]" },
      { input: "nums = [0]", output: "[0]" },
    ],
    tags: ["Array", "Two Pointers"],
    frequency: 84,
  },
  {
    id: 69,
    title: "Trapping Rain Water",
    category: "Two Pointers",
    difficulty: "Hard",
    companies: ["Amazon", "Google", "Goldman Sachs", "Facebook"],
    description:
      "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
    examples: [
      { input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", output: "6" },
      { input: "height = [4,2,0,3,2,5]", output: "9" },
    ],
    tags: ["Array", "Two Pointers", "Dynamic Programming", "Stack", "Monotonic Stack"],
    frequency: 91,
  },
  {
    id: 70,
    title: "Sliding Window Maximum",
    category: "Two Pointers",
    difficulty: "Hard",
    companies: ["Amazon", "Google", "Lyft"],
    description:
      "Given an integer array `nums` and an integer `k`, return the maximum value in each sliding window of size `k`.",
    examples: [
      { input: "nums = [1,3,-1,-3,5,3,6,7], k = 3", output: "[3,3,5,5,6,7]" },
      { input: "nums = [1], k = 1", output: "[1]" },
    ],
    tags: ["Array", "Queue", "Sliding Window", "Heap", "Monotonic Queue"],
    frequency: 82,
  },

  // ─── MATH & BIT MANIPULATION ──────────────────────────────────────────
  {
    id: 71,
    title: "Number of 1 Bits (Hamming Weight)",
    category: "Bit Manipulation",
    difficulty: "Easy",
    companies: ["Apple", "Microsoft"],
    description:
      "Write a function that takes the binary representation of a positive integer and returns the number of set bits (also known as the Hamming weight).",
    examples: [
      { input: "n = 11 (binary: 00000000000000000000000000001011)", output: "3" },
      { input: "n = 128 (binary: 00000000000000000000000010000000)", output: "1" },
    ],
    tags: ["Divide and Conquer", "Bit Manipulation"],
    frequency: 82,
  },
  {
    id: 72,
    title: "Counting Bits",
    category: "Bit Manipulation",
    difficulty: "Easy",
    companies: ["Amazon", "Microsoft"],
    description:
      "Given an integer `n`, return an array `ans` of length n+1 such that for each i (0 ≤ i ≤ n), `ans[i]` is the number of 1's in the binary representation of i.",
    examples: [
      { input: "n = 2", output: "[0,1,1]" },
      { input: "n = 5", output: "[0,1,1,2,1,2]" },
    ],
    tags: ["Dynamic Programming", "Bit Manipulation"],
    frequency: 81,
  },
  {
    id: 73,
    title: "Reverse Bits",
    category: "Bit Manipulation",
    difficulty: "Easy",
    companies: ["Apple", "Amazon"],
    description:
      "Reverse the bits of a given 32-bit unsigned integer.",
    examples: [
      { input: "n = 00000010100101000001111010011100", output: "964176192 (00111001011110000010100101000000)" },
      { input: "n = 11111111111111111111111111111101", output: "3221225471 (10111111111111111111111111111111)" },
    ],
    tags: ["Divide and Conquer", "Bit Manipulation"],
    frequency: 79,
  },
  {
    id: 74,
    title: "Missing Number",
    category: "Bit Manipulation",
    difficulty: "Easy",
    companies: ["Microsoft", "Amazon"],
    description:
      "Given an array `nums` containing n distinct numbers in the range [0, n], return the only number in the range that is missing from the array.",
    examples: [
      { input: "nums = [3,0,1]", output: "2" },
      { input: "nums = [0,1]", output: "2" },
    ],
    tags: ["Array", "Hash Table", "Math", "Bit Manipulation", "Sorting"],
    frequency: 83,
  },
  {
    id: 75,
    title: "Sum of Two Integers (No + operator)",
    category: "Bit Manipulation",
    difficulty: "Medium",
    companies: ["Facebook", "LeetCode"],
    description:
      "Given two integers `a` and `b`, return the sum without using `+` or `-` operators.",
    examples: [
      { input: "a = 1, b = 2", output: "3" },
      { input: "a = 2, b = 3", output: "5" },
    ],
    tags: ["Math", "Bit Manipulation"],
    frequency: 78,
  },

  // ─── STACK & QUEUE ────────────────────────────────────────────────────
  {
    id: 76,
    title: "Min Stack",
    category: "Stack",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg", "Google", "JPMorgan"],
    description:
      "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.\n\nImplement `MinStack` with `push(val)`, `pop()`, `top()`, and `getMin()` all in O(1) time.",
    examples: [
      { input: 'MinStack(), push(-2), push(0), push(-3), getMin() → -3, pop(), top() → 0, getMin() → -2', output: "[null,null,null,null,-3,null,0,-2]" },
    ],
    tags: ["Stack", "Design"],
    frequency: 85,
  },
  {
    id: 77,
    title: "Evaluate Reverse Polish Notation",
    category: "Stack",
    difficulty: "Medium",
    companies: ["Amazon", "LinkedIn"],
    description:
      "Evaluate the value of an arithmetic expression in Reverse Polish Notation. Valid operators are `+`, `-`, `*`, and `/`.",
    examples: [
      { input: 'tokens = ["2","1","+","3","*"]', output: "9", explanation: "((2 + 1) * 3) = 9" },
      { input: 'tokens = ["4","13","5","/","+"]', output: "6" },
    ],
    tags: ["Array", "Math", "Stack"],
    frequency: 79,
  },
  {
    id: 78,
    title: "Daily Temperatures",
    category: "Stack",
    difficulty: "Medium",
    companies: ["Amazon", "Google", "Uber"],
    description:
      "Given an array of integers `temperatures` representing daily temperatures, return an array `answer` such that `answer[i]` is the number of days you have to wait after the ith day to get a warmer temperature. If there is no future day, use 0.",
    examples: [
      { input: "temperatures = [73,74,75,71,69,72,76,73]", output: "[1,1,4,2,1,1,0,0]" },
    ],
    tags: ["Array", "Stack", "Monotonic Stack"],
    frequency: 83,
  },
  {
    id: 79,
    title: "Largest Rectangle in Histogram",
    category: "Stack",
    difficulty: "Hard",
    companies: ["Amazon", "Google", "Citadel"],
    description:
      "Given an array of integers `heights` representing the histogram's bar height, find the area of the largest rectangle in the histogram.",
    examples: [
      { input: "heights = [2,1,5,6,2,3]", output: "10" },
      { input: "heights = [2,4]", output: "4" },
    ],
    tags: ["Array", "Stack", "Monotonic Stack"],
    frequency: 82,
  },

  // ─── MATRIX ───────────────────────────────────────────────────────────
  {
    id: 80,
    title: "Set Matrix Zeroes",
    category: "Matrix",
    difficulty: "Medium",
    companies: ["Amazon", "Microsoft"],
    description:
      "Given an m×n integer matrix, if an element is 0, set its entire row and column to 0's. Do it in-place.",
    examples: [
      { input: "matrix = [[1,1,1],[1,0,1],[1,1,1]]", output: "[[1,0,1],[0,0,0],[1,0,1]]" },
    ],
    tags: ["Array", "Hash Table", "Matrix"],
    frequency: 82,
  },
  {
    id: 81,
    title: "Spiral Matrix",
    category: "Matrix",
    difficulty: "Medium",
    companies: ["Microsoft", "Amazon", "Goldman Sachs"],
    description:
      "Given an m×n matrix, return all elements of the matrix in spiral order.",
    examples: [
      { input: "matrix = [[1,2,3],[4,5,6],[7,8,9]]", output: "[1,2,3,6,9,8,7,4,5]" },
    ],
    tags: ["Array", "Matrix", "Simulation"],
    frequency: 83,
  },
  {
    id: 82,
    title: "Rotate Image",
    category: "Matrix",
    difficulty: "Medium",
    companies: ["Amazon", "Microsoft"],
    description:
      "You are given an n×n 2D matrix representing an image. Rotate the image by 90 degrees (clockwise) in-place.",
    examples: [
      { input: "matrix = [[1,2,3],[4,5,6],[7,8,9]]", output: "[[7,4,1],[8,5,2],[9,6,3]]" },
    ],
    tags: ["Array", "Math", "Matrix"],
    frequency: 81,
  },

  // ─── GREEDY ───────────────────────────────────────────────────────────
  {
    id: 83,
    title: "Jump Game",
    category: "Greedy",
    difficulty: "Medium",
    companies: ["Amazon", "Microsoft"],
    description:
      "You are given an integer array `nums`. You are initially at the first index, and each element in the array represents your maximum jump length at that position. Return `true` if you can reach the last index, or `false` otherwise.",
    examples: [
      { input: "nums = [2,3,1,1,4]", output: "true" },
      { input: "nums = [3,2,1,0,4]", output: "false" },
    ],
    tags: ["Array", "Dynamic Programming", "Greedy"],
    frequency: 84,
  },
  {
    id: 84,
    title: "Jump Game II",
    category: "Greedy",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg"],
    description:
      "Given an array of non-negative integers `nums`, return the minimum number of jumps to reach the last index. You can always reach the last index.",
    examples: [
      { input: "nums = [2,3,1,1,4]", output: "2", explanation: "Jump to index 1 then to the last index" },
      { input: "nums = [2,3,0,1,4]", output: "2" },
    ],
    tags: ["Array", "Dynamic Programming", "Greedy"],
    frequency: 82,
  },
  {
    id: 85,
    title: "Gas Station",
    category: "Greedy",
    difficulty: "Medium",
    companies: ["Amazon", "Snapchat"],
    description:
      "There are `n` gas stations around a circular route. You are given two integer arrays `gas` and `cost`. Return the starting gas station's index if you can travel around the circuit once, otherwise return -1.",
    examples: [
      { input: "gas = [1,2,3,4,5], cost = [3,4,5,1,2]", output: "3" },
      { input: "gas = [2,3,4], cost = [3,4,3]", output: "-1" },
    ],
    tags: ["Array", "Greedy"],
    frequency: 80,
  },

  // ─── INTERVALS ────────────────────────────────────────────────────────
  {
    id: 86,
    title: "Insert Interval",
    category: "Intervals",
    difficulty: "Medium",
    companies: ["Google", "Facebook", "LinkedIn"],
    description:
      "Given an array of non-overlapping intervals sorted by start time, and a new interval, insert it and merge overlapping intervals.",
    examples: [
      { input: "intervals = [[1,3],[6,9]], newInterval = [2,5]", output: "[[1,5],[6,9]]" },
      { input: "intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval = [4,8]", output: "[[1,2],[3,10],[12,16]]" },
    ],
    tags: ["Array"],
    frequency: 83,
  },
  {
    id: 87,
    title: "Merge Intervals",
    category: "Intervals",
    difficulty: "Medium",
    companies: ["Facebook", "Amazon", "Bloomberg", "Google"],
    description:
      "Given an array of intervals where intervals[i] = [start, end], merge all overlapping intervals and return an array of the non-overlapping intervals.",
    examples: [
      { input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]" },
      { input: "intervals = [[1,4],[4,5]]", output: "[[1,5]]" },
    ],
    tags: ["Array", "Sorting"],
    frequency: 87,
  },
  {
    id: 88,
    title: "Meeting Rooms II",
    category: "Intervals",
    difficulty: "Medium",
    companies: ["Facebook", "Amazon", "Bloomberg"],
    description:
      "Given an array of meeting time intervals, find the minimum number of conference rooms required.",
    examples: [
      { input: "intervals = [[0,30],[5,10],[15,20]]", output: "2" },
      { input: "intervals = [[7,10],[2,4]]", output: "1" },
    ],
    tags: ["Array", "Two Pointers", "Greedy", "Sorting", "Heap"],
    frequency: 85,
  },

  // ─── DESIGN ───────────────────────────────────────────────────────────
  {
    id: 89,
    title: "Design Twitter",
    category: "Design",
    difficulty: "Medium",
    companies: ["Twitter", "Amazon", "Facebook"],
    description:
      "Design a simplified version of Twitter where users can post tweets, follow/unfollow other users, and see the 10 most recent tweets in their news feed.",
    examples: [
      { input: "Twitter(), postTweet(1,5), getNewsFeed(1) → [5], follow(1,2), postTweet(2,6), getNewsFeed(1) → [6,5]", output: "..." },
    ],
    tags: ["Hash Table", "Linked List", "Design", "Heap"],
    frequency: 81,
  },
  {
    id: 90,
    title: "Implement Queue using Stacks",
    category: "Design",
    difficulty: "Easy",
    companies: ["Amazon", "Bloomberg", "Microsoft"],
    description:
      "Implement a first in first out (FIFO) queue using only two stacks. Implement `push`, `pop`, `peek`, and `empty` operations.",
    examples: [
      { input: "MyQueue(), push(1), push(2), peek() → 1, pop() → 1, empty() → false", output: "[null,null,null,1,1,false]" },
    ],
    tags: ["Stack", "Design", "Queue"],
    frequency: 82,
  },
  {
    id: 91,
    title: "Time-Based Key-Value Store",
    category: "Design",
    difficulty: "Medium",
    companies: ["Google", "Uber"],
    description:
      "Design a time-based key-value data structure that can store multiple values for the same key at different time stamps and retrieve the key's value at a certain timestamp.",
    examples: [
      { input: 'TimeMap(), set("foo","bar",1), get("foo",1) → "bar", get("foo",3) → "bar", set("foo","bar2",4), get("foo",4) → "bar2", get("foo",5) → "bar2"', output: "..." },
    ],
    tags: ["Hash Table", "String", "Binary Search", "Design"],
    frequency: 80,
  },

  // ─── ADVANCED ─────────────────────────────────────────────────────────
  {
    id: 92,
    title: "Alien Dictionary",
    category: "Graphs",
    difficulty: "Hard",
    companies: ["Facebook", "Airbnb", "Google", "Snapchat"],
    description:
      "Given a list of words from a dictionary sorted in a new alien language, derive the order of letters in the alien alphabet. Return the correct order or empty string if it's invalid.",
    examples: [
      { input: 'words = ["wrt","wrf","er","ett","rftt"]', output: '"wertf"' },
      { input: 'words = ["z","x"]', output: '"zx"' },
    ],
    tags: ["Array", "String", "DFS", "BFS", "Graph", "Topological Sort"],
    frequency: 81,
  },
  {
    id: 93,
    title: "Graph Valid Tree",
    category: "Graphs",
    difficulty: "Medium",
    companies: ["LinkedIn", "Facebook", "Google"],
    description:
      "Given `n` nodes labeled 0 to n-1 and a list of undirected edges, determine if these edges make up a valid tree.",
    examples: [
      { input: "n = 5, edges = [[0,1],[0,2],[0,3],[1,4]]", output: "true" },
      { input: "n = 5, edges = [[0,1],[1,2],[2,3],[1,3],[1,4]]", output: "false" },
    ],
    tags: ["DFS", "BFS", "Union Find", "Graph"],
    frequency: 80,
  },
  {
    id: 94,
    title: "Longest Palindromic Substring",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg", "Facebook"],
    description:
      "Given a string `s`, return the longest palindromic substring in `s`.",
    examples: [
      { input: 's = "babad"', output: '"bab" or "aba"' },
      { input: 's = "cbbd"', output: '"bb"' },
    ],
    tags: ["String", "Dynamic Programming"],
    frequency: 86,
  },
  {
    id: 95,
    title: "Palindromic Substrings",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Facebook", "Lyft"],
    description:
      "Given a string `s`, return the number of palindromic substrings in it. A substring is a contiguous sequence of characters within the string.",
    examples: [
      { input: 's = "abc"', output: "3", explanation: '"a", "b", "c"' },
      { input: 's = "aaa"', output: "6", explanation: '"a", "a", "a", "aa", "aa", "aaa"' },
    ],
    tags: ["String", "Dynamic Programming"],
    frequency: 81,
  },
  {
    id: 96,
    title: "Unique Paths",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg", "Google"],
    description:
      "A robot is located at the top-left corner of an m×n grid. The robot can only move either down or right. How many possible unique paths are there to reach the bottom-right corner?",
    examples: [
      { input: "m = 3, n = 7", output: "28" },
      { input: "m = 3, n = 2", output: "3" },
    ],
    tags: ["Math", "Dynamic Programming", "Combinatorics"],
    frequency: 83,
  },
  {
    id: 97,
    title: "Edit Distance",
    category: "Dynamic Programming",
    difficulty: "Medium",
    companies: ["Amazon", "Google", "Microsoft"],
    description:
      "Given two strings `word1` and `word2`, return the minimum number of operations required to convert `word1` to `word2`. Allowed operations: Insert, Delete, Replace.",
    examples: [
      { input: 'word1 = "horse", word2 = "ros"', output: "3" },
      { input: 'word1 = "intention", word2 = "execution"', output: "5" },
    ],
    tags: ["String", "Dynamic Programming"],
    frequency: 84,
  },
  {
    id: 98,
    title: "Find the Duplicate Number",
    category: "Arrays",
    difficulty: "Medium",
    companies: ["Amazon", "Bloomberg"],
    description:
      "Given an array `nums` containing n+1 integers where each integer is in the range [1, n] inclusive, there is only one repeated number — find that number without modifying the array and using only O(1) extra space.",
    examples: [
      { input: "nums = [1,3,4,2,2]", output: "2" },
      { input: "nums = [3,1,3,4,2]", output: "3" },
    ],
    tags: ["Array", "Two Pointers", "Binary Search", "Bit Manipulation"],
    frequency: 83,
  },
  {
    id: 99,
    title: "Serialize and Deserialize Binary Tree",
    category: "Trees",
    difficulty: "Hard",
    companies: ["Facebook", "Amazon", "Microsoft", "Google"],
    description:
      "Design an algorithm to serialize (convert to string) and deserialize (reconstruct from string) a binary tree. The encoded string is sent over the network.",
    examples: [
      { input: "root = [1,2,3,null,null,4,5]", output: "[1,2,3,null,null,4,5]", explanation: "Serialize then deserialize" },
    ],
    tags: ["String", "Tree", "DFS", "BFS", "Design", "Binary Tree"],
    frequency: 83,
  },
  {
    id: 100,
    title: "Median of Two Sorted Arrays",
    category: "Binary Search",
    difficulty: "Hard",
    companies: ["Amazon", "Google", "Apple", "Goldman Sachs"],
    description:
      "Given two sorted arrays `nums1` and `nums2`, return the median of the two sorted arrays. The overall run time complexity should be O(log(m+n)).",
    examples: [
      { input: "nums1 = [1,3], nums2 = [2]", output: "2.0" },
      { input: "nums1 = [1,2], nums2 = [3,4]", output: "2.5" },
    ],
    tags: ["Array", "Binary Search", "Divide and Conquer"],
    frequency: 88,
  },
]

export const CATEGORIES = [...new Set(QUESTIONS.map(q => q.category))]
export const DIFFICULTIES = ["Easy", "Medium", "Hard"]

export function getDailyQuestion() {
  // Deterministic daily rotation — changes every day
  const epoch = new Date("2025-01-01")
  const today = new Date()
  const dayIndex = Math.floor((today - epoch) / (1000 * 60 * 60 * 24))
  return QUESTIONS[dayIndex % QUESTIONS.length]
}

export function getQuestionById(id) {
  return QUESTIONS.find(q => q.id === parseInt(id))
}

export function filterQuestions({ category, difficulty, company, search } = {}) {
  return QUESTIONS.filter(q => {
    if (category && q.category !== category) return false
    if (difficulty && q.difficulty !== difficulty) return false
    if (company && !q.companies.includes(company)) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        q.title.toLowerCase().includes(s) ||
        q.tags.some(t => t.toLowerCase().includes(s)) ||
        q.companies.some(c => c.toLowerCase().includes(s))
      )
    }
    return true
  })
}
