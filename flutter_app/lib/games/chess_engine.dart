/// Compact chess engine — pieces, moves, check, auto-queen promotion.
/// Board layout: 8x8, indexed [rank 0..7][file 0..7]. Rank 0 = white's back row.
library;

enum PieceType { pawn, knight, bishop, rook, queen, king }
enum PieceColor { white, black }

class Piece {
  final PieceType type;
  final PieceColor color;
  const Piece(this.type, this.color);
  String get glyph {
    const w = {
      PieceType.king: '♔', PieceType.queen: '♕', PieceType.rook: '♖',
      PieceType.bishop: '♗', PieceType.knight: '♘', PieceType.pawn: '♙',
    };
    const b = {
      PieceType.king: '♚', PieceType.queen: '♛', PieceType.rook: '♜',
      PieceType.bishop: '♝', PieceType.knight: '♞', PieceType.pawn: '♟',
    };
    return (color == PieceColor.white ? w : b)[type]!;
  }
}

class Sq {
  final int r, f;
  const Sq(this.r, this.f);
  bool get inBounds => r >= 0 && r < 8 && f >= 0 && f < 8;
  @override
  bool operator ==(Object o) => o is Sq && o.r == r && o.f == f;
  @override
  int get hashCode => r * 8 + f;
}

class ChessState {
  final List<List<Piece?>> board;
  final PieceColor toMove;
  ChessState({required this.board, required this.toMove});

  factory ChessState.initial() {
    final b = List.generate(8, (_) => List<Piece?>.filled(8, null));
    const back = [
      PieceType.rook, PieceType.knight, PieceType.bishop, PieceType.queen,
      PieceType.king, PieceType.bishop, PieceType.knight, PieceType.rook,
    ];
    for (var f = 0; f < 8; f++) {
      b[0][f] = Piece(back[f], PieceColor.white);
      b[1][f] = const Piece(PieceType.pawn, PieceColor.white);
      b[6][f] = const Piece(PieceType.pawn, PieceColor.black);
      b[7][f] = Piece(back[f], PieceColor.black);
    }
    return ChessState(board: b, toMove: PieceColor.white);
  }

  Piece? at(Sq s) => s.inBounds ? board[s.r][s.f] : null;

  ChessState _clone() {
    final b = List.generate(8, (r) => List<Piece?>.from(board[r]));
    return ChessState(board: b, toMove: toMove);
  }

  /// Pseudo-legal moves (without check filter) for the piece at [from].
  List<Sq> pseudoMoves(Sq from) {
    final p = at(from);
    if (p == null) return [];
    final out = <Sq>[];
    void slide(List<List<int>> dirs) {
      for (final d in dirs) {
        var r = from.r + d[0], f = from.f + d[1];
        while (r >= 0 && r < 8 && f >= 0 && f < 8) {
          final t = board[r][f];
          if (t == null) {
            out.add(Sq(r, f));
          } else {
            if (t.color != p.color) out.add(Sq(r, f));
            break;
          }
          r += d[0];
          f += d[1];
        }
      }
    }

    switch (p.type) {
      case PieceType.pawn:
        final dir = p.color == PieceColor.white ? 1 : -1;
        final start = p.color == PieceColor.white ? 1 : 6;
        final one = Sq(from.r + dir, from.f);
        if (one.inBounds && at(one) == null) {
          out.add(one);
          if (from.r == start) {
            final two = Sq(from.r + 2 * dir, from.f);
            if (at(two) == null) out.add(two);
          }
        }
        for (final df in [-1, 1]) {
          final cap = Sq(from.r + dir, from.f + df);
          if (cap.inBounds && at(cap) != null && at(cap)!.color != p.color) {
            out.add(cap);
          }
        }
        break;
      case PieceType.knight:
        for (final d in const [
          [2, 1], [1, 2], [-1, 2], [-2, 1],
          [-2, -1], [-1, -2], [1, -2], [2, -1],
        ]) {
          final s = Sq(from.r + d[0], from.f + d[1]);
          if (!s.inBounds) continue;
          final t = at(s);
          if (t == null || t.color != p.color) out.add(s);
        }
        break;
      case PieceType.bishop:
        slide(const [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
        break;
      case PieceType.rook:
        slide(const [[1, 0], [-1, 0], [0, 1], [0, -1]]);
        break;
      case PieceType.queen:
        slide(const [
          [1, 1], [1, -1], [-1, 1], [-1, -1],
          [1, 0], [-1, 0], [0, 1], [0, -1],
        ]);
        break;
      case PieceType.king:
        for (var dr = -1; dr <= 1; dr++) {
          for (var df = -1; df <= 1; df++) {
            if (dr == 0 && df == 0) continue;
            final s = Sq(from.r + dr, from.f + df);
            if (!s.inBounds) continue;
            final t = at(s);
            if (t == null || t.color != p.color) out.add(s);
          }
        }
        break;
    }
    return out;
  }

  Sq? _findKing(PieceColor c) {
    for (var r = 0; r < 8; r++) {
      for (var f = 0; f < 8; f++) {
        final p = board[r][f];
        if (p != null && p.type == PieceType.king && p.color == c) {
          return Sq(r, f);
        }
      }
    }
    return null;
  }

  bool _isAttacked(Sq target, PieceColor by) {
    for (var r = 0; r < 8; r++) {
      for (var f = 0; f < 8; f++) {
        final p = board[r][f];
        if (p == null || p.color != by) continue;
        if (pseudoMoves(Sq(r, f)).contains(target)) return true;
      }
    }
    return false;
  }

  /// Legal moves = pseudo moves that don't leave own king in check.
  List<Sq> legalMoves(Sq from) {
    final p = at(from);
    if (p == null || p.color != toMove) return [];
    final result = <Sq>[];
    for (final to in pseudoMoves(from)) {
      final next = _clone();
      next._applyRaw(from, to);
      final king = next._findKing(p.color);
      if (king == null) continue;
      if (!next._isAttacked(king, _opp(p.color))) result.add(to);
    }
    return result;
  }

  void _applyRaw(Sq from, Sq to) {
    final p = board[from.r][from.f];
    board[from.r][from.f] = null;
    if (p != null &&
        p.type == PieceType.pawn &&
        (to.r == 0 || to.r == 7)) {
      board[to.r][to.f] = Piece(PieceType.queen, p.color);
    } else {
      board[to.r][to.f] = p;
    }
  }

  /// Returns the new state and the captured piece (if any).
  ({ChessState next, Piece? captured}) move(Sq from, Sq to) {
    final captured = board[to.r][to.f];
    final next = _clone();
    next._applyRaw(from, to);
    return (
      next: ChessState(board: next.board, toMove: _opp(toMove)),
      captured: captured,
    );
  }

  bool inCheck(PieceColor c) {
    final k = _findKing(c);
    if (k == null) return false;
    return _isAttacked(k, _opp(c));
  }

  bool hasAnyLegalMove(PieceColor c) {
    for (var r = 0; r < 8; r++) {
      for (var f = 0; f < 8; f++) {
        final p = board[r][f];
        if (p == null || p.color != c) continue;
        if (legalMoves(Sq(r, f)).isNotEmpty) return true;
      }
    }
    return false;
  }

  static PieceColor _opp(PieceColor c) =>
      c == PieceColor.white ? PieceColor.black : PieceColor.white;

  /// Serialise for realtime sync: 64-cell string (piece codes) + turn.
  Map<String, dynamic> toJson() {
    final cells = <String>[];
    for (var r = 0; r < 8; r++) {
      for (var f = 0; f < 8; f++) {
        final p = board[r][f];
        if (p == null) {
          cells.add('.');
        } else {
          const codes = {
            PieceType.pawn: 'p', PieceType.knight: 'n', PieceType.bishop: 'b',
            PieceType.rook: 'r', PieceType.queen: 'q', PieceType.king: 'k',
          };
          final c = codes[p.type]!;
          cells.add(p.color == PieceColor.white ? c.toUpperCase() : c);
        }
      }
    }
    return {'cells': cells.join(''), 'turn': toMove.name};
  }

  factory ChessState.fromJson(Map<String, dynamic> j) {
    final cells = j['cells'] as String;
    final b = List.generate(8, (_) => List<Piece?>.filled(8, null));
    const map = {
      'p': PieceType.pawn, 'n': PieceType.knight, 'b': PieceType.bishop,
      'r': PieceType.rook, 'q': PieceType.queen, 'k': PieceType.king,
    };
    for (var i = 0; i < 64; i++) {
      final ch = cells[i];
      if (ch == '.') continue;
      final lower = ch.toLowerCase();
      b[i ~/ 8][i % 8] = Piece(
        map[lower]!,
        ch == lower ? PieceColor.black : PieceColor.white,
      );
    }
    return ChessState(
      board: b,
      toMove:
          j['turn'] == 'white' ? PieceColor.white : PieceColor.black,
    );
  }
}
