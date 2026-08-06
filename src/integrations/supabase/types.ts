export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_stickers: {
        Row: {
          created_at: string
          id: string
          mood: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      bucket_list_items: {
        Row: {
          category: string | null
          completed_at: string | null
          completed_note: string | null
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          owner_id: string
          partner_id: string | null
          photo_url: string | null
          priority: number
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          completed_note?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          owner_id: string
          partner_id?: string | null
          photo_url?: string | null
          priority?: number
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          completed_note?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          owner_id?: string
          partner_id?: string | null
          photo_url?: string | null
          priority?: number
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_id: string
          created_at: string
          device_id: string | null
          id: string
          joined_at: string | null
          left_at: string | null
          state: Database["public"]["Enums"]["call_participant_state"]
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          state?: Database["public"]["Enums"]["call_participant_state"]
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          state?: Database["public"]["Enums"]["call_participant_state"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          from_device: string
          from_user: string
          id: string
          kind: Database["public"]["Enums"]["call_signal_kind"]
          payload: Json | null
          to_device: string
          to_user: string
        }
        Insert: {
          call_id: string
          created_at?: string
          from_device: string
          from_user: string
          id?: string
          kind: Database["public"]["Enums"]["call_signal_kind"]
          payload?: Json | null
          to_device: string
          to_user: string
        }
        Update: {
          call_id?: string
          created_at?: string
          from_device?: string
          from_user?: string
          id?: string
          kind?: Database["public"]["Enums"]["call_signal_kind"]
          payload?: Json | null
          to_device?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          ended_reason: string | null
          group_id: string | null
          id: string
          initiator_id: string
          kind: Database["public"]["Enums"]["call_kind"]
          peer_id: string | null
          scope: Database["public"]["Enums"]["call_scope"]
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
        }
        Insert: {
          answered_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          ended_reason?: string | null
          group_id?: string | null
          id?: string
          initiator_id: string
          kind: Database["public"]["Enums"]["call_kind"]
          peer_id?: string | null
          scope: Database["public"]["Enums"]["call_scope"]
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Update: {
          answered_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          ended_reason?: string | null
          group_id?: string | null
          id?: string
          initiator_id?: string
          kind?: Database["public"]["Enums"]["call_kind"]
          peer_id?: string | null
          scope?: Database["public"]["Enums"]["call_scope"]
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Relationships: [
          {
            foreignKeyName: "calls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          background_url: string | null
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          background_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          background_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      chess_games: {
        Row: {
          black_id: string
          black_time_ms: number | null
          created_at: string
          draw_offer_by: string | null
          fen: string
          id: string
          last_move_at: string
          pgn: string
          rematch_offer_by: string | null
          status: string
          time_control_seconds: number | null
          time_increment_seconds: number | null
          turn: string
          undo_request_by: string | null
          updated_at: string
          white_id: string
          white_time_ms: number | null
          winner: string | null
        }
        Insert: {
          black_id: string
          black_time_ms?: number | null
          created_at?: string
          draw_offer_by?: string | null
          fen?: string
          id?: string
          last_move_at?: string
          pgn?: string
          rematch_offer_by?: string | null
          status?: string
          time_control_seconds?: number | null
          time_increment_seconds?: number | null
          turn?: string
          undo_request_by?: string | null
          updated_at?: string
          white_id: string
          white_time_ms?: number | null
          winner?: string | null
        }
        Update: {
          black_id?: string
          black_time_ms?: number | null
          created_at?: string
          draw_offer_by?: string | null
          fen?: string
          id?: string
          last_move_at?: string
          pgn?: string
          rematch_offer_by?: string | null
          status?: string
          time_control_seconds?: number | null
          time_increment_seconds?: number | null
          turn?: string
          undo_request_by?: string | null
          updated_at?: string
          white_id?: string
          white_time_ms?: number | null
          winner?: string | null
        }
        Relationships: []
      }
      coin_bundles: {
        Row: {
          active: boolean
          bonus_label: string | null
          bundle_key: string
          coins: number
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          price_paise: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          bonus_label?: string | null
          bundle_key: string
          coins: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          price_paise: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          bonus_label?: string | null
          bundle_key?: string
          coins?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          price_paise?: number
          sort_order?: number
        }
        Relationships: []
      }
      coin_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coin_purchases: {
        Row: {
          amount_paise: number
          bundle_id: string
          coins: number
          created_at: string
          credited_at: string | null
          currency: string
          id: string
          paid_at: string | null
          razorpay_order_id: string
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          bundle_id: string
          coins: number
          created_at?: string
          credited_at?: string | null
          currency?: string
          id?: string
          paid_at?: string | null
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          bundle_id?: string
          coins?: number
          created_at?: string
          credited_at?: string | null
          currency?: string
          id?: string
          paid_at?: string | null
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_purchases_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "coin_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_suggestions: {
        Row: {
          author_id: string
          body: string
          created_at: string
          dismissed: boolean
          id: string
          kind: string
          meta: Json
          partner_id: string
          saved: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string
          created_at?: string
          dismissed?: boolean
          id?: string
          kind: string
          meta?: Json
          partner_id: string
          saved?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          dismissed?: boolean
          id?: string
          kind?: string
          meta?: Json
          partner_id?: string
          saved?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      constellation_notes: {
        Row: {
          author_id: string
          created_at: string
          glyph: string
          id: string
          note: string
          occurred_at: string
          partner_id: string
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          glyph?: string
          id?: string
          note?: string
          occurred_at?: string
          partner_id: string
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          glyph?: string
          id?: string
          note?: string
          occurred_at?: string
          partner_id?: string
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_episodes: {
        Row: {
          created_at: string
          created_by: string | null
          episode: number
          id: string
          movie_id: string
          overview: string | null
          runtime: number | null
          season: number
          still_url: string | null
          title: string | null
          updated_at: string
          use_vidking: boolean
          video_qualities: Json
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          episode: number
          id?: string
          movie_id: string
          overview?: string | null
          runtime?: number | null
          season: number
          still_url?: string | null
          title?: string | null
          updated_at?: string
          use_vidking?: boolean
          video_qualities?: Json
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          episode?: number
          id?: string
          movie_id?: string
          overview?: string | null
          runtime?: number | null
          season?: number
          still_url?: string | null
          title?: string | null
          updated_at?: string
          use_vidking?: boolean
          video_qualities?: Json
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_episodes_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "custom_movies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_movies: {
        Row: {
          backdrop_url: string | null
          created_at: string
          created_by: string
          genres: string[]
          id: string
          media_type: string
          overview: string | null
          poster_url: string | null
          runtime: number | null
          title: string
          tmdb_id: number | null
          updated_at: string
          use_vidking: boolean
          video_qualities: Json
          video_storage_path: string | null
          video_url: string | null
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          created_at?: string
          created_by: string
          genres?: string[]
          id?: string
          media_type?: string
          overview?: string | null
          poster_url?: string | null
          runtime?: number | null
          title: string
          tmdb_id?: number | null
          updated_at?: string
          use_vidking?: boolean
          video_qualities?: Json
          video_storage_path?: string | null
          video_url?: string | null
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          created_at?: string
          created_by?: string
          genres?: string[]
          id?: string
          media_type?: string
          overview?: string | null
          poster_url?: string | null
          runtime?: number | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string
          use_vidking?: boolean
          video_qualities?: Json
          video_storage_path?: string | null
          video_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      daily_answers: {
        Row: {
          answer: string
          created_at: string
          date: string
          id: string
          partner_id: string | null
          question_id: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          date?: string
          id?: string
          partner_id?: string | null
          question_id: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          date?: string
          id?: string
          partner_id?: string | null
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "daily_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          partner_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          partner_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          partner_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_questions: {
        Row: {
          created_at: string
          day_index: number
          id: string
          prompt: string
        }
        Insert: {
          created_at?: string
          day_index: number
          id?: string
          prompt: string
        }
        Update: {
          created_at?: string
          day_index?: number
          id?: string
          prompt?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          created_at: string
          game: string
          host_id: string
          id: string
          partner_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          game: string
          host_id: string
          id?: string
          partner_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          game?: string
          host_id?: string
          id?: string
          partner_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      group_event_rsvps: {
        Row: {
          event_id: string
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          response: string
          updated_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
        ]
      }
      group_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          location: string | null
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          location?: string | null
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_match_participants: {
        Row: {
          joined_at: string
          match_id: string
          role: string
          seat: number | null
          user_id: string
        }
        Insert: {
          joined_at?: string
          match_id: string
          role: string
          seat?: number | null
          user_id: string
        }
        Update: {
          joined_at?: string
          match_id?: string
          role?: string
          seat?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "group_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      group_matches: {
        Row: {
          created_at: string
          created_by: string
          ended_at: string | null
          external_ref: string | null
          game: string
          group_id: string
          id: string
          max_players: number
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ended_at?: string | null
          external_ref?: string | null
          game: string
          group_id: string
          id?: string
          max_players?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ended_at?: string | null
          external_ref?: string | null
          game?: string
          group_id?: string
          id?: string
          max_players?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reads: {
        Row: {
          group_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      important_dates: {
        Row: {
          created_at: string
          date: string
          emoji: string | null
          id: string
          kind: string
          note: string | null
          owner_id: string
          person_id: string | null
          title: string
          updated_at: string
          yearly: boolean
        }
        Insert: {
          created_at?: string
          date: string
          emoji?: string | null
          id?: string
          kind?: string
          note?: string | null
          owner_id: string
          person_id?: string | null
          title: string
          updated_at?: string
          yearly?: boolean
        }
        Update: {
          created_at?: string
          date?: string
          emoji?: string | null
          id?: string
          kind?: string
          note?: string | null
          owner_id?: string
          person_id?: string | null
          title?: string
          updated_at?: string
          yearly?: boolean
        }
        Relationships: []
      }
      love_coupons: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          expires_at: string | null
          giver_id: string
          id: string
          recipient_id: string
          redeemed_at: string | null
          redeemed_note: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          expires_at?: string | null
          giver_id: string
          id?: string
          recipient_id: string
          redeemed_at?: string | null
          redeemed_note?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          expires_at?: string | null
          giver_id?: string
          id?: string
          recipient_id?: string
          redeemed_at?: string | null
          redeemed_note?: string | null
          title?: string
        }
        Relationships: []
      }
      love_letters: {
        Row: {
          body: string
          created_at: string
          id: string
          opened_at: string | null
          photo_url: string | null
          recipient_id: string
          replied_at: string | null
          reply_body: string | null
          reply_reaction: string | null
          seal_motto: string | null
          sender_id: string
          style: Json
          theme: string
          title: string
          unlock_at: string
          unlock_on_anniversary: boolean
          updated_at: string
          voice_url: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          opened_at?: string | null
          photo_url?: string | null
          recipient_id: string
          replied_at?: string | null
          reply_body?: string | null
          reply_reaction?: string | null
          seal_motto?: string | null
          sender_id: string
          style?: Json
          theme?: string
          title?: string
          unlock_at?: string
          unlock_on_anniversary?: boolean
          updated_at?: string
          voice_url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          opened_at?: string | null
          photo_url?: string | null
          recipient_id?: string
          replied_at?: string | null
          reply_body?: string | null
          reply_reaction?: string | null
          seal_motto?: string | null
          sender_id?: string
          style?: Json
          theme?: string
          title?: string
          unlock_at?: string
          unlock_on_anniversary?: boolean
          updated_at?: string
          voice_url?: string | null
        }
        Relationships: []
      }
      match_player_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          match_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          match_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_player_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "group_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_jar: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          happened_on: string | null
          id: string
          mood: string | null
          partner_id: string | null
          photo_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          happened_on?: string | null
          id?: string
          mood?: string | null
          partner_id?: string | null
          photo_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          happened_on?: string | null
          id?: string
          mood?: string | null
          partner_id?: string | null
          photo_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          group_id: string | null
          id: string
          link_preview: Json | null
          media_meta: Json | null
          media_url: string | null
          pinned: boolean
          pinned_at: string | null
          pinned_by: string | null
          reactions: Json
          read_at: string | null
          receiver_id: string | null
          reply_to_id: string | null
          sender_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          group_id?: string | null
          id?: string
          link_preview?: Json | null
          media_meta?: Json | null
          media_url?: string | null
          pinned?: boolean
          pinned_at?: string | null
          pinned_by?: string | null
          reactions?: Json
          read_at?: string | null
          receiver_id?: string | null
          reply_to_id?: string | null
          sender_id: string
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          group_id?: string | null
          id?: string
          link_preview?: Json | null
          media_meta?: Json | null
          media_url?: string | null
          pinned?: boolean
          pinned_at?: string | null
          pinned_by?: string | null
          reactions?: Json
          read_at?: string | null
          receiver_id?: string | null
          reply_to_id?: string | null
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_log: {
        Row: {
          created_at: string
          date: string
          emoji: string | null
          id: string
          label: string | null
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          emoji?: string | null
          id?: string
          label?: string | null
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          emoji?: string | null
          id?: string
          label?: string | null
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      movie_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: string
          movie_id: number
          receiver_id: string
          sender_id: string
          type: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string
          movie_id: number
          receiver_id: string
          sender_id: string
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string
          movie_id?: number
          receiver_id?: string
          sender_id?: string
          type?: string
        }
        Relationships: []
      }
      observer_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          match_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          match_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observer_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "group_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      paint_gallery: {
        Row: {
          background: string | null
          by_user: string
          created_at: string
          id: string
          pair_key: string
          strokes: Json
          title: string | null
        }
        Insert: {
          background?: string | null
          by_user: string
          created_at?: string
          id?: string
          pair_key: string
          strokes: Json
          title?: string | null
        }
        Update: {
          background?: string | null
          by_user?: string
          created_at?: string
          id?: string
          pair_key?: string
          strokes?: Json
          title?: string | null
        }
        Relationships: []
      }
      paint_strokes: {
        Row: {
          by_user: string
          created_at: string
          id: string
          pair_key: string
          stroke: Json
        }
        Insert: {
          by_user: string
          created_at?: string
          id: string
          pair_key: string
          stroke: Json
        }
        Update: {
          by_user?: string
          created_at?: string
          id?: string
          pair_key?: string
          stroke?: Json
        }
        Relationships: []
      }
      pet_pandas: {
        Row: {
          affection: number
          costume: string
          created_at: string
          interactions: number
          last_visit: string | null
          name: string
          streak: number
          unlocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          affection?: number
          costume?: string
          created_at?: string
          interactions?: number
          last_visit?: string | null
          name?: string
          streak?: number
          unlocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          affection?: number
          costume?: string
          created_at?: string
          interactions?: number
          last_visit?: string | null
          name?: string
          streak?: number
          unlocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          message_id: string
          option_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          option_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          option_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      post_movie_prompts: {
        Row: {
          created_at: string
          favorite_moment: string | null
          id: string
          mood: string | null
          movie_id: string
          note: string | null
          partner_id: string | null
          rating: number | null
          updated_at: string
          user_id: string
          would_rewatch: boolean | null
        }
        Insert: {
          created_at?: string
          favorite_moment?: string | null
          id?: string
          mood?: string | null
          movie_id: string
          note?: string | null
          partner_id?: string | null
          rating?: number | null
          updated_at?: string
          user_id: string
          would_rewatch?: boolean | null
        }
        Update: {
          created_at?: string
          favorite_moment?: string | null
          id?: string
          mood?: string | null
          movie_id?: string
          note?: string | null
          partner_id?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string
          would_rewatch?: boolean | null
        }
        Relationships: []
      }
      profile_achievements: {
        Row: {
          acquired_at: string
          id: string
          tag_key: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          tag_key: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          id?: string
          tag_key?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_visible: boolean
          anniversary_date: string | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          coins: number
          created_at: string
          display_name: string
          equipped_tags: string[]
          favorite_color: string | null
          favorite_emoji: string | null
          id: string
          invite_code: string
          is_admin: boolean
          last_seen_at: string | null
          last_seen_visible: boolean
          mood: string | null
          mood_emoji: string | null
          mood_updated_at: string | null
          notifications_enabled: boolean
          paired_at: string | null
          panda_coins: number
          partner_id: string | null
          partner_nickname: string | null
          pl_cat_activity: boolean
          pl_cat_card: boolean
          pl_cat_creative: boolean
          pl_cat_photo: boolean
          pl_cat_video: boolean
          pl_cat_voice: boolean
          pl_cat_writing: boolean
          punishment_lock_enabled: boolean
          read_receipts_enabled: boolean
          updated_at: string
          username: string
        }
        Insert: {
          activity_visible?: boolean
          anniversary_date?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          coins?: number
          created_at?: string
          display_name: string
          equipped_tags?: string[]
          favorite_color?: string | null
          favorite_emoji?: string | null
          id: string
          invite_code?: string
          is_admin?: boolean
          last_seen_at?: string | null
          last_seen_visible?: boolean
          mood?: string | null
          mood_emoji?: string | null
          mood_updated_at?: string | null
          notifications_enabled?: boolean
          paired_at?: string | null
          panda_coins?: number
          partner_id?: string | null
          partner_nickname?: string | null
          pl_cat_activity?: boolean
          pl_cat_card?: boolean
          pl_cat_creative?: boolean
          pl_cat_photo?: boolean
          pl_cat_video?: boolean
          pl_cat_voice?: boolean
          pl_cat_writing?: boolean
          punishment_lock_enabled?: boolean
          read_receipts_enabled?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          activity_visible?: boolean
          anniversary_date?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          coins?: number
          created_at?: string
          display_name?: string
          equipped_tags?: string[]
          favorite_color?: string | null
          favorite_emoji?: string | null
          id?: string
          invite_code?: string
          is_admin?: boolean
          last_seen_at?: string | null
          last_seen_visible?: boolean
          mood?: string | null
          mood_emoji?: string | null
          mood_updated_at?: string | null
          notifications_enabled?: boolean
          paired_at?: string | null
          panda_coins?: number
          partner_id?: string | null
          partner_nickname?: string | null
          pl_cat_activity?: boolean
          pl_cat_card?: boolean
          pl_cat_creative?: boolean
          pl_cat_photo?: boolean
          pl_cat_video?: boolean
          pl_cat_voice?: boolean
          pl_cat_writing?: boolean
          punishment_lock_enabled?: boolean
          read_receipts_enabled?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      punishment_locks: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          locker_id: string
          max_duration_seconds: number | null
          progress: number
          prompt: string
          required_count: number
          shared: boolean
          status: Database["public"]["Enums"]["punishment_status"]
          target_id: string
          type: Database["public"]["Enums"]["punishment_type"]
          updated_at: string
          verification_feedback: string | null
          verification_status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          locker_id: string
          max_duration_seconds?: number | null
          progress?: number
          prompt: string
          required_count?: number
          shared?: boolean
          status?: Database["public"]["Enums"]["punishment_status"]
          target_id: string
          type: Database["public"]["Enums"]["punishment_type"]
          updated_at?: string
          verification_feedback?: string | null
          verification_status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          locker_id?: string
          max_duration_seconds?: number | null
          progress?: number
          prompt?: string
          required_count?: number
          shared?: boolean
          status?: Database["public"]["Enums"]["punishment_status"]
          target_id?: string
          type?: Database["public"]["Enums"]["punishment_type"]
          updated_at?: string
          verification_feedback?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      punishment_verification_messages: {
        Row: {
          approved: boolean | null
          content: string | null
          created_at: string
          feedback: string | null
          id: string
          kind: string
          lock_id: string
          media_meta: Json | null
          media_url: string | null
          sender_id: string
          submission: boolean
        }
        Insert: {
          approved?: boolean | null
          content?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          kind?: string
          lock_id: string
          media_meta?: Json | null
          media_url?: string | null
          sender_id: string
          submission?: boolean
        }
        Update: {
          approved?: boolean | null
          content?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          kind?: string
          lock_id?: string
          media_meta?: Json | null
          media_url?: string | null
          sender_id?: string
          submission?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "punishment_verification_messages_lock_id_fkey"
            columns: ["lock_id"]
            isOneToOne: false
            referencedRelation: "punishment_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_journal_entries: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          mood: string | null
          partner_a: string
          partner_b: string
          photo_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          mood?: string | null
          partner_a: string
          partner_b: string
          photo_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          mood?: string | null
          partner_a?: string
          partner_b?: string
          photo_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rituals: {
        Row: {
          ended_at: string | null
          host_id: string
          id: string
          kind: string
          partner_id: string
          started_at: string
          state: Json
          status: string
          updated_at: string
        }
        Insert: {
          ended_at?: string | null
          host_id: string
          id?: string
          kind: string
          partner_id: string
          started_at?: string
          state?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          ended_at?: string | null
          host_id?: string
          id?: string
          kind?: string
          partner_id?: string
          started_at?: string
          state?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          content: string
          created_at: string
          delivered_at: string | null
          disappear_seconds: number | null
          group_id: string | null
          id: string
          media_meta: Json | null
          media_url: string | null
          receiver_id: string | null
          reply_to_id: string | null
          scheduled_for: string
          sender_id: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          delivered_at?: string | null
          disappear_seconds?: number | null
          group_id?: string | null
          id?: string
          media_meta?: Json | null
          media_url?: string | null
          receiver_id?: string | null
          reply_to_id?: string | null
          scheduled_for: string
          sender_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          delivered_at?: string | null
          disappear_seconds?: number | null
          group_id?: string | null
          id?: string
          media_meta?: Json | null
          media_url?: string | null
          receiver_id?: string | null
          reply_to_id?: string | null
          scheduled_for?: string
          sender_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      scribble_stats: {
        Row: {
          correct_guesses: number
          created_at: string
          games_played: number
          rounds_drawn: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          correct_guesses?: number
          created_at?: string
          games_played?: number
          rounds_drawn?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          correct_guesses?: number
          created_at?: string
          games_played?: number
          rounds_drawn?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          id: string
          item_key: string
          metadata: Json
          name: string
          preview_url: string | null
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          id?: string
          item_key: string
          metadata?: Json
          name: string
          preview_url?: string | null
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          item_key?: string
          metadata?: Json
          name?: string
          preview_url?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_flags: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sticker_admin: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          kind: string
          label: string | null
          sticker_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          kind: string
          label?: string | null
          sticker_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          label?: string | null
          sticker_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      time_capsules: {
        Row: {
          content: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
          title: string | null
          unlock_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
          title?: string | null
          unlock_at: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          title?: string | null
          unlock_at?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          acquired_at: string
          equipped: boolean
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          equipped?: boolean
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          equipped?: boolean
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_rooms: {
        Row: {
          created_at: string
          host_id: string
          id: string
          is_playing: boolean
          last_actor_id: string | null
          last_event: string | null
          partner_id: string
          position_seconds: number
          updated_at: string
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          is_playing?: boolean
          last_actor_id?: string | null
          last_event?: string | null
          partner_id: string
          position_seconds?: number
          updated_at?: string
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          is_playing?: boolean
          last_actor_id?: string | null
          last_event?: string | null
          partner_id?: string
          position_seconds?: number
          updated_at?: string
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      watch_sync_members: {
        Row: {
          current_seconds: number
          duration_seconds: number
          episode: number | null
          event: string | null
          event_at: string | null
          is_host: boolean
          joined_at: string
          last_seen_at: string
          partner_id: string | null
          playback_rate: number
          ready: boolean
          room_key: string
          season: number | null
          source_idx: number
          source_kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_seconds?: number
          duration_seconds?: number
          episode?: number | null
          event?: string | null
          event_at?: string | null
          is_host?: boolean
          joined_at?: string
          last_seen_at?: string
          partner_id?: string | null
          playback_rate?: number
          ready?: boolean
          room_key: string
          season?: number | null
          source_idx?: number
          source_kind?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_seconds?: number
          duration_seconds?: number
          episode?: number | null
          event?: string | null
          event_at?: string | null
          is_host?: boolean
          joined_at?: string
          last_seen_at?: string
          partner_id?: string | null
          playback_rate?: number
          ready?: boolean
          room_key?: string
          season?: number | null
          source_idx?: number
          source_kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          added_by: string
          created_at: string
          id: string
          media_type: string
          note: string | null
          overview: string | null
          owner_id: string
          partner_id: string | null
          poster_url: string | null
          title: string
          tmdb_id: number | null
          updated_at: string
          watched: boolean
          watched_at: string | null
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          media_type?: string
          note?: string | null
          overview?: string | null
          owner_id: string
          partner_id?: string | null
          poster_url?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string
          watched?: boolean
          watched_at?: string | null
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          media_type?: string
          note?: string | null
          overview?: string | null
          owner_id?: string
          partner_id?: string | null
          poster_url?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string
          watched?: boolean
          watched_at?: string | null
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          claimed_by: string | null
          created_at: string
          got_it: boolean
          id: string
          image_url: string | null
          note: string | null
          owner_id: string
          partner_id: string | null
          priority: number
          title: string
          updated_at: string
          url: string | null
          votes: Json
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          got_it?: boolean
          id?: string
          image_url?: string | null
          note?: string | null
          owner_id: string
          partner_id?: string | null
          priority?: number
          title: string
          updated_at?: string
          url?: string | null
          votes?: Json
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          got_it?: boolean
          id?: string
          image_url?: string | null
          note?: string | null
          owner_id?: string
          partner_id?: string | null
          priority?: number
          title?: string
          updated_at?: string
          url?: string | null
          votes?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_grant_coins: {
        Args: { _amount: number; _note?: string; _target: string }
        Returns: number
      }
      call_answer: {
        Args: { _call_id: string; _device_id: string }
        Returns: {
          answered_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          ended_reason: string | null
          group_id: string | null
          id: string
          initiator_id: string
          kind: Database["public"]["Enums"]["call_kind"]
          peer_id: string | null
          scope: Database["public"]["Enums"]["call_scope"]
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      call_decline: { Args: { _call_id: string }; Returns: undefined }
      call_end: {
        Args: { _call_id: string; _reason?: string }
        Returns: undefined
      }
      call_leave: { Args: { _call_id: string }; Returns: undefined }
      call_start_direct: {
        Args: { _kind: Database["public"]["Enums"]["call_kind"]; _peer: string }
        Returns: {
          answered_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          ended_reason: string | null
          group_id: string | null
          id: string
          initiator_id: string
          kind: Database["public"]["Enums"]["call_kind"]
          peer_id: string | null
          scope: Database["public"]["Enums"]["call_scope"]
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      call_start_group: {
        Args: {
          _group_id: string
          _kind: Database["public"]["Enums"]["call_kind"]
        }
        Returns: {
          answered_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          ended_reason: string | null
          group_id: string | null
          id: string
          initiator_id: string
          kind: Database["public"]["Enums"]["call_kind"]
          peer_id: string | null
          scope: Database["public"]["Enums"]["call_scope"]
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      call_timeout: { Args: { _call_id: string }; Returns: undefined }
      chat_group_messages: {
        Args: { _before?: string; _group_id: string; _limit?: number }
        Returns: {
          content: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          group_id: string | null
          id: string
          link_preview: Json | null
          media_meta: Json | null
          media_url: string | null
          pinned: boolean
          pinned_at: string | null
          pinned_by: string | null
          reactions: Json
          read_at: string | null
          receiver_id: string | null
          reply_to_id: string | null
          sender_id: string
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      chat_messages_between: {
        Args: { _before?: string; _limit?: number; _peer: string }
        Returns: {
          content: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          group_id: string | null
          id: string
          link_preview: Json | null
          media_meta: Json | null
          media_url: string | null
          pinned: boolean
          pinned_at: string | null
          pinned_by: string | null
          reactions: Json
          read_at: string | null
          receiver_id: string | null
          reply_to_id: string | null
          sender_id: string
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_admin: { Args: { _pin: string }; Returns: boolean }
      couple_streak: {
        Args: { _me: string; _partner: string }
        Returns: number
      }
      create_group_match: {
        Args: { _game: string; _group_id: string; _max_players?: number }
        Returns: {
          created_at: string
          created_by: string
          ended_at: string | null
          external_ref: string | null
          game: string
          group_id: string
          id: string
          max_players: number
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "group_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_coin_purchase: { Args: { _payment_id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      friend_profiles_for_me: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      gen_group_invite_code: { Args: never; Returns: string }
      grant_coins: {
        Args: { _amount: number; _reason: string; _ref_id?: string }
        Returns: number
      }
      has_answered_on: {
        Args: { _date: string; _user: string }
        Returns: boolean
      }
      is_accepted_friend: { Args: { _other: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_call_participant: {
        Args: { _call_id: string; _uid: string }
        Returns: boolean
      }
      is_group_admin: { Args: { _gid: string; _uid: string }; Returns: boolean }
      is_group_member: {
        Args: { _gid: string; _uid: string }
        Returns: boolean
      }
      is_match_observer: {
        Args: { _match_id: string; _uid: string }
        Returns: boolean
      }
      is_match_player: {
        Args: { _match_id: string; _uid: string }
        Returns: boolean
      }
      is_paint_pair_member: { Args: { _pair_key: string }; Returns: boolean }
      is_username_available: { Args: { _username: string }; Returns: boolean }
      is_watch_party_member: {
        Args: { _pid: string; _uid: string }
        Returns: boolean
      }
      join_group_match: { Args: { _match_id: string }; Returns: string }
      join_group_with_code: {
        Args: { _code: string }
        Returns: {
          avatar_url: string | null
          background_url: string | null
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
          theme: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      open_love_letter: {
        Args: { _id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          opened_at: string | null
          photo_url: string | null
          recipient_id: string
          replied_at: string | null
          reply_body: string | null
          reply_reaction: string | null
          seal_motto: string | null
          sender_id: string
          style: Json
          theme: string
          title: string
          unlock_at: string
          unlock_on_anniversary: boolean
          updated_at: string
          voice_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "love_letters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pair_with_invite_code: {
        Args: { _code: string }
        Returns: {
          activity_visible: boolean
          anniversary_date: string | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          coins: number
          created_at: string
          display_name: string
          equipped_tags: string[]
          favorite_color: string | null
          favorite_emoji: string | null
          id: string
          invite_code: string
          is_admin: boolean
          last_seen_at: string | null
          last_seen_visible: boolean
          mood: string | null
          mood_emoji: string | null
          mood_updated_at: string | null
          notifications_enabled: boolean
          paired_at: string | null
          panda_coins: number
          partner_id: string | null
          partner_nickname: string | null
          pl_cat_activity: boolean
          pl_cat_card: boolean
          pl_cat_creative: boolean
          pl_cat_photo: boolean
          pl_cat_video: boolean
          pl_cat_voice: boolean
          pl_cat_writing: boolean
          punishment_lock_enabled: boolean
          read_receipts_enabled: boolean
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purchase_shop_item: { Args: { _item_id: string }; Returns: Json }
      purge_expired_messages: { Args: never; Returns: undefined }
      purge_stale_call_signals: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      regenerate_group_invite_code: { Args: { _gid: string }; Returns: string }
      revoke_admin: {
        Args: { _pin: string; _target: string }
        Returns: boolean
      }
      search_profiles: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      start_group_match: {
        Args: { _match_id: string }
        Returns: {
          created_at: string
          created_by: string
          ended_at: string | null
          external_ref: string | null
          game: string
          group_id: string
          id: string
          max_players: number
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "group_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suggest_usernames: {
        Args: { _base: string; _count?: number }
        Returns: string[]
      }
      toggle_equip_item: {
        Args: { _equip: boolean; _item_id: string }
        Returns: undefined
      }
      unpair_partner: { Args: never; Returns: undefined }
    }
    Enums: {
      call_kind: "voice" | "video"
      call_participant_state:
        | "ringing"
        | "joined"
        | "declined"
        | "left"
        | "missed"
      call_scope: "direct" | "group"
      call_signal_kind: "offer" | "answer" | "ice" | "bye"
      call_status: "ringing" | "active" | "ended" | "missed"
      punishment_status: "active" | "completed" | "cancelled" | "expired"
      punishment_type:
        | "write"
        | "compliment"
        | "funny"
        | "draw"
        | "photo"
        | "voice"
        | "quiz"
        | "card"
        | "video"
        | "activity"
        | "creative"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      call_kind: ["voice", "video"],
      call_participant_state: [
        "ringing",
        "joined",
        "declined",
        "left",
        "missed",
      ],
      call_scope: ["direct", "group"],
      call_signal_kind: ["offer", "answer", "ice", "bye"],
      call_status: ["ringing", "active", "ended", "missed"],
      punishment_status: ["active", "completed", "cancelled", "expired"],
      punishment_type: [
        "write",
        "compliment",
        "funny",
        "draw",
        "photo",
        "voice",
        "quiz",
        "card",
        "video",
        "activity",
        "creative",
      ],
    },
  },
} as const
