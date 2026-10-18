
import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { JarvisConversation } from '../models/JarvisConversation.js';

import { askJarvis } from '../services/jarvisAI.js';
import { answerEventQuestion } from '../services/jarvisEvents.js';

import {
  isEventCreationRequest,
  prepareEventDraft,
} from '../services/jarvisDraft.js';

import {
  createJarvisEvent,
  parseEventEditCommand,
  updateJarvisEvent,
  prepareJarvisRename,
  cancelJarvisRename,
} from '../services/jarvisActions.js';

import {
  getPendingRename,
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

// Backend status.
router.get('/status', (req, res) => {
  res.json({
    name: 'J.A.R.V.I.S.',
    status: 'online',
    phase: 'autonomous-approval-1',
    aiEnabled: Boolean(
      process.env.GEMINI_API_KEY ||
      process.env.GROQ_API_KEY
    ),
    eventIntelligenceEnabled: true,
    autonomousEventCreation: true,
    autonomousEventEditing: true,
    sensitiveApprovalEnabled: Boolean(
      process.env.JARVIS_ACCESS_KEY_HASH
    ),
    monitoringEnabled: false,
  });
});

// Saved conversation memory.
router.get('/history', async (req, res, next) => {
  try {
    const conversation =
      await JarvisConversation.findOne({
        admin: req.admin._id,
      }).lean();

    res.json({
      messages: conversation?.messages || [],
    });
  } catch (error) {
    next(error);
  }
});

// Access-key verification endpoint.
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

    // Never store the actual access key.
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

// Main J.A.R.V.I.S. conversation endpoint.
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

    const history = (
      conversation?.messages || []
    )
      .slice(-11)
      .map(item => ({
        role: item.role,
        content: item.content,
      }));

    let reply;
    let provider = 'certiflow';
    let draft = null;
    let createdEvent = null;
    let approvalRequired = false;
    let approvalId = null;

    const editCommand = parseEventEditCommand(content);

    if (editCommand) {
      // Sensitive event rename.
      if (
        editCommand.type === 'rename' ||
        editCommand.type === 'confirm-rename'
      ) {
        if (req.admin.role !== 'admin') {
          reply =
            'Access denied. Only an administrator can authorize sensitive operations.';
        } else if (
          !process.env.JARVIS_ACCESS_KEY_HASH
        ) {
          reply =
            'Access-key verification is not configured on the server.';
        } else {
          const prepared =
            editCommand.type === 'rename'
              ? await prepareJarvisRename({
                  command: editCommand,
                  admin: req.admin,
                  instruction: content,
                })
              : null;

          const pending =
            await getPendingRename(req.admin._id);

          if (
            pending &&
            (
              editCommand.type === 'confirm-rename' ||
              prepared?.pending
            )
          ) {
            approvalRequired = true;
            approvalId = String(pending._id);

            reply = [
              prepared?.message ||
                `Pending rename: ${pending.details?.oldName} → ${pending.details?.newName}`,
              '',
              'Please enter the access key to continue.',
            ].join('\n');
          } else {
            reply =
              prepared?.message ||
              'No eligible pending rename was found.';
          }
        }
      } else if (
        editCommand.type === 'cancel-rename'
      ) {
        const result = await cancelJarvisRename({
          admin: req.admin,
        });

        reply = result.message;
      } else if (
        ['venue', 'description'].includes(
          editCommand.type
        )
      ) {
        const result = await updateJarvisEvent({
          command: editCommand,
          admin: req.admin,
          instruction: content,
        });

        reply = result.message;
      } else {
        reply =
          'Unsupported event editing command.';
      }
    } else {
      const directCreation =
        /\b(create|add|make|schedule|set up)\b/i
          .test(content) &&
        /\b(event|workshop|seminar|webinar|hackathon|conference|competition|session|training)\b/i
          .test(content) &&
        !/\b(don't|do not|without creating|just explain|only explain|draft|preview|suggest|help me|how to)\b/i
          .test(content);

      if (
        directCreation ||
        isEventCreationRequest(content)
      ) {
        const prepared =
          await prepareEventDraft(content);

        provider = prepared.provider;
        draft = prepared.draft;

        if (
          directCreation &&
          !prepared.missing.length
        ) {
          const action = await createJarvisEvent({
            draft,
            admin: req.admin,
            instruction: content,
          });

          if (action.success) {
            createdEvent = action.event;
            draft = null;

            reply = [
              'Event created successfully.',
              '',
              `Name: ${createdEvent.name}`,
              `Organizer: ${createdEvent.organizer}`,
              `Date and time: ${createdEvent.date}`,
              `Venue: ${createdEvent.venue || 'Not specified'}`,
              '',
              'Feedback is disabled until you review and activate the event.',
            ].join('\n');
          } else {
            draft = null;
            reply = action.message;
          }
        } else {
          reply = [
            'Event draft prepared.',
            '',
            `Name: ${draft.name || 'Not specified'}`,
            `Organizer: ${draft.organizer || 'Not specified'}`,
            `Date and time: ${draft.date || 'Not specified'}`,
            `Venue: ${draft.venue || 'Not specified'}`,
            '',
            prepared.missing.length
              ? `Missing: ${prepared.missing.join(', ')}`
              : 'Ready for review.',
            '',
            'Select Review Event Draft to continue.',
            'No event has been created.',
          ].join('\n');
        }
      } else {
        const eventAnswer =
          await answerEventQuestion(content);

        if (eventAnswer !== null) {
          reply = eventAnswer;
        } else {
          const response = await askJarvis([
            ...history,
            {
              role: 'user',
              content,
            },
          ]);

          reply = response.reply;
          provider = response.provider;
        }
      }
    }

    await saveMessages(
      req.admin._id,
      content,
      reply,
      provider
    );

    return res.json({
      reply,
      provider,
      draft,
      createdEvent,
      approvalRequired,
      approvalId,
    });
  } catch (error) {
    console.error(
      'J.A.R.V.I.S. chat failed:',
      error.message
    );

    return res.status(503).json({
      error:
        'J.A.R.V.I.S. could not complete this request. Check the event record before retrying.',
    });
  }
});

export default router;
