import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

// Create post
router.post('/', authenticate, async (req, res) => {
  try {
    const { image, caption } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const post = new Post({
      user: req.user._id,
      image,
      caption: caption || ''
    });

    await post.save();
    await User.findByIdAndUpdate(req.user._id, {
      $push: { posts: post._id }
    });

    const populatedPost = await Post.findById(post._id)
      .populate('user', 'username avatar fullName');

    res.status(201).json(populatedPost);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all posts (feed) - works with or without auth
router.get('/feed', optionalAuthenticate, async (req, res) => {
  try {
    let posts;
    if (req.user) {
      const currentUser = await User.findById(req.user._id);
      const followingIds = [...(currentUser?.following || []), currentUser._id];
      posts = await Post.find({ user: { $in: followingIds } })
        .populate('user', 'username avatar fullName')
        .populate('likes', 'username avatar')
        .populate('comments.user', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(50);
    }
    // No user or no posts from followed users - show discover feed
    if (!req.user || !posts || posts.length === 0) {
      posts = await Post.find({})
        .populate('user', 'username avatar fullName')
        .populate('likes', 'username avatar')
        .populate('comments.user', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(50);
    }

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all posts (explore/discover)
router.get('/explore', optionalAuthenticate, async (req, res) => {
  try {
    const posts = await Post.find({})
      .populate('user', 'username avatar fullName')
      .populate('likes', 'username avatar')
      .populate('comments.user', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single post
router.get('/:postId', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('user', 'username avatar fullName')
      .populate('likes', 'username avatar')
      .populate('comments.user', 'username avatar');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Like post
router.post('/:postId/like', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isLiked = post.likes.includes(req.user._id);

    if (isLiked) {
      post.likes = post.likes.filter(
        id => id.toString() !== req.user._id.toString()
      );
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    res.json({ likes: post.likes.length, isLiked: !isLiked });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Comment on post
router.post('/:postId/comment', authenticate, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.comments.push({
      user: req.user._id,
      text
    });

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('comments.user', 'username avatar');

    res.json(updatedPost.comments[updatedPost.comments.length - 1]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete post
router.delete('/:postId', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { posts: post._id }
    });

    await Post.findByIdAndDelete(req.params.postId);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
