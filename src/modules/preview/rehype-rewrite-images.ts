import { visit } from 'unist-util-visit';

type Options = {
  resolve: (src: string) => string | null;
};

export default function rehypeRewriteImages(options: Options) {
  return function transform(tree: any) {
    visit(tree, 'element', (node: any) => [node].forEach((n) => {
      if (!n || n.tagName !== 'img') return;
      const props = n.properties || {};
      const src: string | undefined = props.src;
      if (!src) return;
      const next = options.resolve(src);
      if (next) {
        n.properties = { ...props, src: next };
      }
    }));
  };
}

