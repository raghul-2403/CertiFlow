
import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';

import { JarvisConversation } from '../models/JarvisConversation.js';

import {
  runJarvisAgent,
} from '../services/jarvisAgent.js';

import {
  authorizeRename,
} from '../services/jarvisApproval.js';

const router = Router();

router.use(requireAuth);

async function saveMessages(
  adminId,
  userMessage,
  assistantMessage,
  provider = 'certiflow'
) {
  try {
    await JarvisConversation.findOneAndUpdate(
      {
        admin: adminId,
      },
      {
        $push: {
          messages: {
            $each: [
              {
                role: 'user',
                content: userMessage,
              },
              {
                role: 'assistant',
                content: assistantMessage,
                provider,
              },
            ],
            $slice: -40,
          },
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );
  } catch (error) {
    console.error(
      'J.A.R.V.I.S. memory save failed:',
      error.message
    );
  }
}

router.get('/status', (req, res) => {
  res.json({
    name: 'J.A.R.V.I.S.',
    status: 'online',
    phase: 'agent-core-v1',
    aiEnabled: Boolean(
      process.env.GEMINI_API_KEY ||
      process.env.GROQ_API_KEY
    ),
    eventIntelligenceEnabled: true,
    agentEnabled: true,
    autonomousEventCreation: true,
    autonomousEventEditing: true,
    feedbackControlEnabled: true,
    sensitiveApprovalEnabled: Boolean(
      process.env.JARVIS_ACCESS_KEY_HASH
    ),
    monitoringEnabled: false,
  });
});

router.get('/history', async (req, res, next) => {
  try {
    const conversation =
      await JarvisConversation.findOne({
        admin: req.admin._id,
      }).lean();

    return res.json({
      messages: conversation?.messages || [],
    });
  } catch (error) {
    next(error);
  }
});

// Sensitive authorization is separate from chat.
// Never pass access keys through AI or chat history.
router.post('/approval', async (req, res, next) => {
  try {
    const {
      actionId,
      accessKey,
    } = req.body || {};

    const result = await authorizeRename({
      admin: req.admin,
      actionId,
      accessKey,
    });

    if (result.approved) {
      await saveMessages(
        req.admin._id,
        '[Authorized event rename]',
        result.result,
        'certiflow'
      );
    }

    const statusCode = result.approved
      ? 200
      : result.configurationError
        ? 503
        : result.executionFailed
          ? 409
          : 403;

    return res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
});

// Natural-language J.A.R.V.I.S. Agent endpoint.
router.post('/chat', async (req, res) => {
  const message = req.body?.message;

  if (
    typeof message !== 'string' ||
    !message.trim() ||
    message.length > 2000
  ) {
    return res.status(400).json({
      error:
        'Message must contain 1 to 2000 characters.',
    });
  }

  const content = message.trim();

  try {
    const conversation =
      await JarvisConversation.findOne({
        admin: req.admin._id,
      }).lean();

    const history = (conversation?.messages || [])
      .slice(-12)
      .map(item => ({
        role: item.role,
        content: item.content,
      }));

    const result = await runJarvisAgent({
      message: content,
      history,
      admin: req.admin,
    });

    await saveMessages(
      req.admin._id,
      content,
      result.reply,
      result.provider
    );


return res.json({
  reply: result.reply,
  provider: result.provider,
  draft: result.draft,
  createdEvent: result.createdEvent,
  approvalRequired: result.approvalRequired,
  approvalId: result.approvalId,
  dataChanged: result.dataChanged === true,
});

  } catch (error) {
    console.error(
      'J.A.R.V.I.S. Agent failed:',
      error.message
    );

    return res.status(503).json({
      error:
        'J.A.R.V.I.S. could not complete the request. ' +
        'Please check event records before retrying.',
    });
  }
});

export default router;
