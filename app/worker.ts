import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we are using CDN
env.allowLocalModels = false;

class PipelineSingleton {
    static task = 'text-classification';
    static model = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
    static instance: unknown = null;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    static async getInstance(progress_callback: Function) {
        if (this.instance === null) {
            // Create the pipeline safely
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.instance = await pipeline(this.task as any, this.model, { progress_callback });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event: MessageEvent) => {
    // Immediately log that worker received it!
    self.postMessage({ status: 'progress', data: { status: 'initiate' } });

    const { id, text } = event.data;

    try {
        const classifier = await PipelineSingleton.getInstance((progress: unknown) => {
            self.postMessage({ status: 'progress', data: progress });
        }) as (text: string) => Promise<Array<{ label: string, score: number }>>;

        const output = await classifier(text);

        // Distilbert output: [{ label: 'POSITIVE', score: 0.99 }, ...]
        self.postMessage({
            status: 'complete',
            id,
            label: output[0].label,
            score: output[0].score
        });
    } catch (err) {
        self.postMessage({ status: 'error', id, error: String(err) });
    }
});
