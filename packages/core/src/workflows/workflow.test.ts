import { createLogger } from '../logger';
import { z } from 'zod';
import { describe, it, expect, jest } from '@jest/globals';

import { Workflow } from './workflow';
import { Step } from './step';

describe('Workflow', () => {

  describe('Basic Workflow Execution', () => {
    it('should execute a single step workflow successfully', async () => {
      const action = jest.fn<any>().mockResolvedValue({ result: 'success' });

      const step1 = new Step({id: 'step1', action});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1],
      });

      workflow.step("step1").commit();

      const result = await workflow.execute();

      expect(action).toHaveBeenCalled();
      expect(result.results['step1']).toEqual({ result: 'success' });
    });

    it('should execute multiple steps based on transitions', async () => {
      const executionOrder: string[] = [];

      const step1Action = jest.fn<any>().mockImplementation(async () => {
        executionOrder.push('step1');
        return { value: 'step1' };
      });
      const step2Action = jest.fn<any>().mockImplementation(async () => {
        executionOrder.push('step2');
        return { value: 'step2' };
      });

      const step1 = new Step({id: 'step1', action: step1Action});
      const step2 = new Step({id: 'step2', action: step2Action});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1, step2],
      });

      workflow
        .step('step1', {
          transitions: {
            step2: { condition: undefined },
          },
        })
        .step('step2')
        .commit();

      const result = await workflow.execute();

      expect(executionOrder).toEqual(['step1', 'step2']);
      expect(result.results).toEqual({
        step1: { value: 'step1' },
        step2: { value: 'step2' },
      });
    });
  });

  describe('Transition Conditions', () => {
    it('should follow conditional transitions', async () => {
      const step1Action = jest.fn<any>().mockImplementation(() => {
        return Promise.resolve({ status: 'success' });
      });
      const step2Action = jest.fn<any>().mockImplementation(() => {
        return Promise.resolve({ result: 'step2' });
      });
      const step3Action = jest.fn<any>().mockImplementation(() => {
        return Promise.resolve({ result: 'step3' });
      });

      const step1 = new Step({id: 'step1', action: step1Action});
      const step2 = new Step({id: 'step2', action: step2Action});
      const step3 = new Step({id: 'step3', action: step3Action});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1, step2, step3],
      });

      workflow
        .step('step1', {
          transitions: {
            step2: {
              condition: {
                ref: { stepId: 'step1', path: 'status' },
                query: { $eq: 'success' },
              },
            },
            step3: {
              condition: {
                ref: { stepId: 'step1', path: 'status' },
                query: { $eq: 'failed' },
              },
            },
          },
        })
        .step('step2')
        .step('step3')
        .commit();

      const result = await workflow.execute();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });

    it('should handle complex transition conditions', async () => {
      const step1Action = jest.fn<any>().mockResolvedValue({
        status: 'success',
        count: 5,
      });
      const step2Action = jest.fn<any>().mockResolvedValue({ result: 'step2' });
      const step3Action = jest.fn<any>().mockResolvedValue({ result: 'step3' });

      const step1 = new Step({id: 'step1', action: step1Action});
      const step2 = new Step({id: 'step2', action: step2Action});
      const step3 = new Step({id: 'step3', action: step3Action});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1, step2, step3],
      });

      workflow
        .step('step1', {
          transitions: {
            step2: {
              condition: {
                and: [
                  {
                    ref: { stepId: 'step1', path: 'status' },
                    query: { $eq: 'success' },
                  },
                  {
                    ref: { stepId: 'step1', path: 'count' },
                    query: { $gte: 3 },
                  },
                ],
              },
            },
            step3: {
              condition: {
                or: [
                  {
                    ref: { stepId: 'step1', path: 'status' },
                    query: { $eq: 'failed' },
                  },
                  {
                    ref: { stepId: 'step1', path: 'count' },
                    query: { $lt: 3 },
                  },
                ],
              },
            },
          },
        })
        .step('step2')
        .step('step3')
        .commit();

      const result = await workflow.execute();

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });
  });

  describe('Workflow Validation', () => {
    const step1 = new Step({id: 'step1'});
    const step2 = new Step({id: 'step2'});
    const step3 = new Step({id: 'step3'});

    describe('Circular Dependencies', () => {

      it('should detect simple circular dependency', () => {
        const workflow = new Workflow({
          name: 'test-workflow',
          logger: createLogger({ type: 'CONSOLE' }),
          steps: [step1, step2, step3],
        });

        expect(() => {
          workflow
            .step('step1', {
            transitions: {
              step2: { condition: undefined },
            },
          })
          .step('step2', {
            transitions: {
              step1: { condition: undefined },
            },
          })
          .commit();
        }).toThrow('Circular dependency detected');
      });

      it('should detect complex circular dependency', () => {
        const workflow = new Workflow({
          name: 'test-workflow',
          logger: createLogger({ type: 'CONSOLE' }),
          steps: [step1, step2, step3],
        });

        expect(() => {
          workflow
            .step('step1', {
              transitions: {
                step2: { condition: undefined },
              },
            })
            .step('step2', {
              transitions: {
                step3: { condition: undefined },
              },
            })
            .step('step3', {
              transitions: {
                step1: { condition: undefined },
              },
            })
            .commit();
        }).toThrow('Circular dependency detected');
      });
    });

    describe('Terminal Paths', () => {
      it('should detect when no path leads to terminal state', () => {
        const workflow = new Workflow({
          name: 'test-workflow',
          logger: createLogger({ type: 'CONSOLE' }),
          steps: [step1, step2],
        });

        expect(() => {
          workflow
            .step('step1', {
              transitions: {
                step2: { condition: undefined },
              },
            })
            .step('step2', {
              transitions: {
                step1: { condition: undefined },
              },
            })
            .commit();
        }).toThrow('No path to terminal state found');
      });

      it('should validate workflow with valid terminal path', () => {
        const workflow = new Workflow({
          name: 'test-workflow',
          logger: createLogger({ type: 'CONSOLE' }),
          steps: [step1, step2],
        });

        expect(() => {
          workflow
            .step('step1', {
              transitions: {
                step2: { condition: undefined },
              },
            })
            .step('step2')
            .commit();
        }).not.toThrow();
      });

      it('should validate workflow with multiple valid terminal paths', () => {
        const workflow = new Workflow({
          name: 'test-workflow',
          logger: createLogger({ type: 'CONSOLE' }),
          steps: [step1, step2, step3],
        });

        expect(() => {
          workflow
            .step('step1', {
              transitions: {
                step2: { condition: undefined },
                step3: { condition: undefined },
              },
            })
            .step('step2')
            .step('step3')
            .commit();
        }).not.toThrow();
      });
    });

    describe('Unreachable Steps', () => {
      it('should detect unreachable steps', () => {
        const workflow = new Workflow({
          name: 'test-workflow',
          logger: createLogger({ type: 'CONSOLE' }),
          steps: [step1, step2, step3],
        });

        expect(() => {
          workflow
            .step('step1', {
              transitions: {
                step2: { condition: undefined },
              },
            })
            .step('step2')
            .step('step3')
            .commit();
        }).toThrow('Step is not reachable from the initial step (Step: step3)');
      });

      it('should validate fully connected workflow', () => {
        const workflow = new Workflow({
          name: 'test-workflow',
          logger: createLogger({ type: 'CONSOLE' }),
          steps: [step1, step2, step3],
        });

        expect(() => {
          workflow
            .step('step1', {
              transitions: {
                step2: { condition: undefined },
                step3: { condition: undefined },
              },
            })
            .step('step2')
            .step('step3')
            .commit();
        }).not.toThrow();
      });
    });

    describe('Complex Validation Scenarios', () => {
      it('should detect multiple validation issues', () => {
        const workflow = new Workflow({
          name: 'test-workflow',
          logger: createLogger({ type: 'CONSOLE' }),
          steps: [step1, step2, step3],
        });

        expect(() => {
          workflow
            .step('step1', {
              transitions: {
                step2: { condition: undefined },
              },
            })
            .step('step2', {
              transitions: {
                step1: { condition: undefined },
              },
            })
            .step('step3')
            .commit();
        }).toThrow(
          `Workflow validation failed:
[circular_dependency] Circular dependency detected in workflow (Path: step1 → step2 → step1)
[no_terminal_path] No path to terminal state found (Path: step1 → step2) (Step: step2)
[no_terminal_path] No path to terminal state found (Path: step1) (Step: step1)
[unreachable_step] Step is not reachable from the initial step (Step: step3)`
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      const error = new Error('Step execution failed');
      const failingAction = jest.fn<any>().mockRejectedValue(error);

      const step1 = new Step({id: 'step1', action: failingAction});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1],
      });

      workflow
        .step('step1')
        .commit();

      await expect(workflow.execute()).rejects.toEqual({
        error: 'Step execution failed',
      });
    });

    it('should handle variable resolution errors', async () => {
      const step1 = new Step({id: 'step1', action: jest.fn<any>().mockResolvedValue({ data: 'success' })});
      const step2 = new Step({id: 'step2', action: jest.fn<any>()});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1, step2],
      });

      workflow
        .step('step1', {
          transitions: {
            step2: { condition: undefined },
          },
        })
        .step('step2', {
          variables: {
            data: { stepId: 'step1', path: 'nonexistent.path' },
          },
        })
        .commit();

      await expect(workflow.execute()).rejects.toEqual({
        error: 'Cannot resolve path "nonexistent.path" from step1',
      });
    });
  });

  describe('Variable Resolution', () => {
    it('should resolve variables from trigger data', async () => {
      const action = jest.fn<any>().mockResolvedValue({ result: 'success' });
      const triggerSchema = z.object({
        inputData: z.string(),
      });

      const step1 = new Step({id: 'step1', action});

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema,
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1],
      });

      workflow
        .step('step1', {
          variables: {
            input: { stepId: 'trigger', path: 'inputData' },
          },
        })
        .commit();

      await workflow.execute({ inputData: 'test-input' });

      expect(action).toHaveBeenCalledWith({ input: 'test-input' });
    });

    it('should resolve variables from previous steps', async () => {
      const step1Action = jest.fn<any>().mockResolvedValue({
        nested: { value: 'step1-data' },
      });
      const step2Action = jest
        .fn<any>()
        .mockResolvedValue({ result: 'success' });

      const step1 = new Step({id: 'step1', action: step1Action});
      const step2 = new Step({id: 'step2', action: step2Action});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1, step2],
      });

      workflow
        .step('step1', {
          transitions: {
            step2: { condition: undefined },
          },
        })
        .step('step2', {
          variables: {
            previousValue: { stepId: 'step1', path: 'nested.value' },
          },
        })
        .commit();

      await workflow.execute();

      expect(step2Action).toHaveBeenCalledWith({
        previousValue: 'step1-data',
      });
    });
  });

  describe('Complex Conditions', () => {
    it('should handle nested AND/OR conditions', async () => {
      const step1Action = jest.fn<any>().mockResolvedValue({
        status: 'partial',
        score: 75,
        flags: { isValid: true },
      });
      const step2Action = jest.fn<any>().mockResolvedValue({ result: 'step2' });
      const step3Action = jest.fn<any>().mockResolvedValue({ result: 'step3' });

      const step1 = new Step({id: 'step1', action: step1Action});
      const step2 = new Step({id: 'step2', action: step2Action});
      const step3 = new Step({id: 'step3', action: step3Action});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1, step2, step3],
      });

      workflow
        .step('step1', {
          transitions: {
            step2: {
              condition: {
                and: [
                  {
                    or: [
                      {
                        ref: { stepId: 'step1', path: 'status' },
                        query: { $eq: 'success' },
                      },
                      {
                        and: [
                          {
                            ref: { stepId: 'step1', path: 'status' },
                            query: { $eq: 'partial' },
                          },
                          {
                            ref: { stepId: 'step1', path: 'score' },
                            query: { $gte: 70 },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    ref: { stepId: 'step1', path: 'flags.isValid' },
                    query: { $eq: true },
                  },
                ],
              },
            },
            step3: {
              condition: {
                or: [
                  {
                    ref: { stepId: 'step1', path: 'status' },
                    query: { $eq: 'failed' },
                  },
                  {
                    ref: { stepId: 'step1', path: 'score' },
                    query: { $lt: 70 },
                  },
                ],
              },
            },
          },
        })
        .step('step2')
        .step('step3')
        .commit();

      const result = await workflow.execute();

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });
    it('should handle case where no transition conditions match', async () => {
      const start = new Step({id: 'start', action: jest.fn<any>().mockResolvedValue({ status: 'unknown' })});
      const success = new Step({id: 'success', action: jest.fn<any>().mockResolvedValue({ result: 'success' })});
      const failure = new Step({id: 'failure', action: jest.fn<any>().mockResolvedValue({ result: 'failure' })});

      const workflow = new Workflow({
        name: 'test-workflow',
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [start, success, failure],
      });

      workflow
        .step('start', {
          transitions: {
            success: {
              condition: {
                ref: { stepId: 'start', path: 'status' },
                query: { $eq: 'success' },
              },
            },
            failure: {
              condition: {
                ref: { stepId: 'start', path: 'status' },
                query: { $eq: 'failed' },
              },
            },
          },
        })
        .step('success')
        .step('failure')
        .commit();

      await expect(workflow.execute()).rejects.toEqual({
        error: 'No matching transition conditions',
      });
    });
  });

  describe('Schema Validation', () => {
    it('should validate trigger data against schema', async () => {
      const triggerSchema = z.object({
        required: z.string(),
        nested: z.object({
          value: z.number(),
        }),
      });

      const step1 = new Step({id: 'step1', action: jest.fn<any>().mockResolvedValue({ result: 'success' })});

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema,
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [step1],
      });

      workflow
        .step('step1')
        .commit();

      // Should fail validation
      await expect(
        workflow.execute({
          required: 'test',
          // @ts-expect-error
          nested: { value: 'not-a-number' },
        })
      ).rejects.toThrow();

      // Should pass validation
      await workflow.execute({
        required: 'test',
        nested: { value: 42 },
      });
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle a multi-step workflow with data transformations', async () => {
      const triggerSchema = z.object({
        items: z.array(
          z.object({
            id: z.number(),
            value: z.number(),
          })
        ),
      });

      const filter = new Step({id: 'filter', action: async (data: any) => {
        return {
          filtered: data.items.filter((item: any) => item.value > 50),
        };
      }});
      const process = new Step({id: 'process', action: async (data: any) => {
        return {
          processed: data.items.map((item: any) => ({
            id: item.id,
            doubled: item.value * 2,
          })),
        };
      }});
      const noResults = new Step({id: 'noResults', action: async () => ({ status: 'no-items-to-process' })});

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema,
        logger: createLogger({ type: 'CONSOLE' }),
        steps: [filter, process, noResults],
      });

      workflow
        .step('filter', {
          variables: {
            items: { stepId: 'trigger', path: '.' },
          },
          transitions: {
            process: {
              condition: {
                ref: { stepId: 'filter', path: 'filtered' },
                query: { $where: (value: any) => value.length > 0 },
              },
            },
            noResults: {
              condition: {
                ref: { stepId: 'filter', path: 'filtered' },
                query: { $where: (value: any) => value.length === 0 },
              },
            },
          },
        })
        .step('process', {
          variables: {
            items: { stepId: 'filter', path: 'filtered' },
          },
        })
        .step('noResults')
        .commit();

      const result = await workflow.execute({
        items: [
          { id: 1, value: 25 },
          { id: 2, value: 75 },
          { id: 3, value: 100 },
        ],
      });

      expect((result.results.filter as any).filtered).toHaveLength(2);
      expect((result.results.process as any).processed).toEqual([
        { id: 2, doubled: 150 },
        { id: 3, doubled: 200 },
      ]);
    });
  });
});
