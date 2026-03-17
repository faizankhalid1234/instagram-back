import express from 'express';
import Story from '../models/Story.js';
import User from '../models/User.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

// Create story
router.post('/', authenticate, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const story = new Story({
      user: req.user._id,
      image
    });

    await story.save();

    const populatedStory = await Story.findById(story._id)
      .populate('user', 'username avatar');

    res.status(201).json(populatedStory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get stories feed - works with or without auth
router.get('/feed', optionalAuthenticate, async (req, res) => {
  try {
    let stories;
    if (req.user) {
      const currentUser = await User.findById(req.user._id);
      const followingIds = [...(currentUser?.following || []), currentUser._id];
      stories = await Story.find({
        user: { $in: followingIds },
        expiresAt: { $gt: new Date() }
      })
        .populate('user', 'username avatar')
        .sort({ createdAt: -1 });

      if (stories.length === 0) {
        stories = await Story.find({ expiresAt: { $gt: new Date() } })
          .populate('user', 'username avatar')
          .sort({ createdAt: -1 });
      }
    } else {
      stories = await Story.find({ expiresAt: { $gt: new Date() } })
        .populate('user', 'username avatar')
        .sort({ createdAt: -1 });
    }

    const groupedStories = {};
    stories.forEach(story => {
      const userId = story.user?._id?.toString();
      if (userId) {
        if (!groupedStories[userId]) {
          groupedStories[userId] = {
            user: story.user,
            stories: []
          };
        }
        groupedStories[userId].stories.push(story);
      }
    });

    res.json(Object.values(groupedStories));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// View story
router.post('/:storyId/view', authenticate, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);

    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    if (!story.views.includes(req.user._id)) {
      story.views.push(req.user._id);
      await story.save();
    }

    res.json({ message: 'Story viewed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
