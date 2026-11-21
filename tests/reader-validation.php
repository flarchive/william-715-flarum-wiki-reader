<?php

declare(strict_types=1);

// Standalone validation smoke test: does not require a running Flarum instance.
// The CI PHP image has mbstring; simple fallbacks make local syntax-only
// environments usable for these ASCII fixtures.
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $s): int { return strlen($s); }
    function mb_substr(string $s, int $start, ?int $len = null): string {
        return $len === null ? substr($s, $start) : substr($s, $start, $len);
    }
}
require __DIR__.'/../src/Controller/ReaderController.php';

$probe = new class extends \StartPro\WikiReader\Controller\ReaderController {
    public function ctx(mixed $v): ?array { return $this->positionContext($v); }
    public function lbl(mixed $v, string $fallback = 'book'): ?string { return $this->label($v, $fallback); }
    public function noteValue(mixed $v): ?string { return $this->note($v); }
};

$ctx = $probe->ctx([
    'quote' => ['exact' => str_repeat('x', 300), 'prefix' => 'hello', 'suffix' => 'world'],
    'block' => ['index' => 6, 'ratio' => 450, 'preview' => str_repeat('y', 300)],
    'heading' => 'wiki-introduction',
]);
assert($ctx !== null);
if (strlen($ctx['quote']['exact']) !== 100 || strlen($ctx['block']['preview']) !== 160) throw new RuntimeException('Context length bounds failed');
if ($ctx['block']['index'] !== 6 || $ctx['block']['ratio'] !== 450) throw new RuntimeException('Context position validation failed');
if ($probe->ctx('not an object') !== null) throw new RuntimeException('Invalid context accepted');
if ($probe->noteValue(str_repeat('a', 1001)) !== null) throw new RuntimeException('Long note accepted');
if ($probe->lbl('', 'Fallback Book') !== 'Fallback Book') throw new RuntimeException('Label fallback failed');
if ($probe->lbl(new stdClass()) !== null) throw new RuntimeException('Invalid label accepted');
echo "Reader context, note and label validation: OK\n";
