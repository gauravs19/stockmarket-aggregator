import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we are using CDN
env.allowLocalModels = false;

class PipelineFactory {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static instances: Record<string, any> = {};

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    static async getInstance(task: string, model: string, progress_callback: Function) {
        if (!this.instances[task]) {
            // Create the pipeline safely
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.instances[task] = await pipeline(task as any, model, { progress_callback });
        }
        return this.instances[task];
    }
}

self.addEventListener('message', async (event: MessageEvent) => {
    // Immediately log that worker received it!
    const { action, id, text } = event.data;
    self.postMessage({ status: 'progress', action, data: { status: 'initiate' } });

    try {
        if (action === 'classify') {
            const classifier = await PipelineFactory.getInstance(
                'text-classification',
                'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
                (progress: unknown) => {
                    self.postMessage({ status: 'progress', action, data: progress });
                }
            );

            const output = await classifier(text);

            self.postMessage({
                status: 'complete',
                action,
                id,
                label: output[0].label,
                score: output[0].score
            });
        } else if (action === 'summarize') {
            const summarizer = await PipelineFactory.getInstance(
                'summarization',
                'Xenova/distilbart-cnn-6-6',
                (progress: unknown) => {
                    self.postMessage({ status: 'progress', action, data: progress });
                }
            );

            const output = await summarizer(text, {
                max_new_tokens: 150,
                min_length: 30
            });

            self.postMessage({
                status: 'complete',
                action,
                summary: output[0].summary_text
            });
        }
    } catch (err) {
        self.postMessage({ status: 'error', action, id, error: String(err) });
    }
});
