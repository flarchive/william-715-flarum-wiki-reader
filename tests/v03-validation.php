<?php

declare(strict_types=1);

if (!function_exists('mb_strlen')) {
    function mb_strlen(string $s): int { return strlen($s); }
    function mb_substr(string $s, int $start, ?int $len = null): string {
        return $len === null ? substr($s, $start) : substr($s, $start, $len);
    }
}
require __DIR__.'/../src/Controller/ReaderController.php';

$check = new class extends \StartPro\WikiReader\Controller\ReaderController {
    public function text(mixed $v, int $max, bool $required = false): ?string {
        return $this->boundedText($v, $max, $required);
    }
    public function quoteCtx(mixed $v): ?array { return $this->positionContext($v); }
    public function privateNote(mixed $v): ?string { return $this->note($v); }
};

if ($check->text('  a   b  ', 10, true) !== 'a b') throw new RuntimeException('Whitespace normalizer failed');
if ($check->text('', 10, true) !== null) throw new RuntimeException('Empty required quote accepted');
if ($check->text(str_repeat('q', 501), 500, true) !== null) throw new RuntimeException('Oversized quote accepted');
if ($check->privateNote(str_repeat('a', 1001)) !== null) throw new RuntimeException('Oversized private note accepted');
if ($check->text(['unexpected' => 'object'], 10) !== null) throw new RuntimeException('Invalid scalar accepted');
if ($check->quoteCtx(['v' => 1, 'block' => ['index' => 4, 'ratio' => 650],
    'quote' => ['exact' => 'Cross-device paragraph', 'prefix' => 'hello', 'suffix' => 'world']])['quote']['exact'] !== 'Cross-device paragraph') {
    throw new RuntimeException('Position context normalization failed');
}
echo "v0.3 quote, note and context bounds: OK\n";
