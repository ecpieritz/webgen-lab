export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          WebGen Lab
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Reproducible experiments in AI-driven web development.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          A controlled environment for evaluating model-generated web
          applications while preserving the original conversation and results.
        </p>
      </section>
    </main>
  );
}
