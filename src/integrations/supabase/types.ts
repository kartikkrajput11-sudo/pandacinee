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
      call_signals: {
        Row: {
          created_at: string
          from_id: string
          id: string
          kind: string
          payload: Json | null
          to_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          id?: string
          kind: string
          payload?: Json | null
          to_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          id?: string
          kind?: string
          payload?: Json | null
          to_id?: string
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
      messages: {
        Row: {
          content: string
          created_at: string
          expires_at: string | null
          id: string
          media_meta: Json | null
          media_url: string | null
          pinned: boolean
          reactions: Json
          read_at: string | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          media_meta?: Json | null
          media_url?: string | null
          pinned?: boolean
          reactions?: Json
          read_at?: string | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          media_meta?: Json | null
          media_url?: string | null
          pinned?: boolean
          reactions?: Json
          read_at?: string | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
          type?: string
        }
        Relationships: [
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
      profiles: {
        Row: {
          anniversary_date: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          favorite_color: string | null
          favorite_emoji: string | null
          id: string
          invite_code: string
          mood: string | null
          mood_emoji: string | null
          mood_updated_at: string | null
          paired_at: string | null
          partner_id: string | null
          partner_nickname: string | null
          updated_at: string
          username: string
        }
        Insert: {
          anniversary_date?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          favorite_color?: string | null
          favorite_emoji?: string | null
          id: string
          invite_code?: string
          mood?: string | null
          mood_emoji?: string | null
          mood_updated_at?: string | null
          paired_at?: string | null
          partner_id?: string | null
          partner_nickname?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          anniversary_date?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          favorite_color?: string | null
          favorite_emoji?: string | null
          id?: string
          invite_code?: string
          mood?: string | null
          mood_emoji?: string | null
          mood_updated_at?: string | null
          paired_at?: string | null
          partner_id?: string | null
          partner_nickname?: string | null
          updated_at?: string
          username?: string
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
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      couple_streak: {
        Args: { _me: string; _partner: string }
        Returns: number
      }
      has_answered_on: {
        Args: { _date: string; _user: string }
        Returns: boolean
      }
      is_accepted_friend: { Args: { _other: string }; Returns: boolean }
      pair_with_invite_code: {
        Args: { _code: string }
        Returns: {
          anniversary_date: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          favorite_color: string | null
          favorite_emoji: string | null
          id: string
          invite_code: string
          mood: string | null
          mood_emoji: string | null
          mood_updated_at: string | null
          paired_at: string | null
          partner_id: string | null
          partner_nickname: string | null
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
      purge_expired_messages: { Args: never; Returns: undefined }
      search_profiles: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
