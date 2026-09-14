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
      achievements: {
        Row: {
          condition_type: string
          condition_value: number
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_published: boolean
          name: string
          updated_at: string
        }
        Insert: {
          condition_type: string
          condition_value: number
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_published?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_published?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      ai_content_drafts: {
        Row: {
          content: Json
          created_at: string
          id: string
          mission_id: string
          status: Database["public"]["Enums"]["ai_content_draft_status"]
          updated_at: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          mission_id: string
          status?: Database["public"]["Enums"]["ai_content_draft_status"]
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          mission_id?: string
          status?: Database["public"]["Enums"]["ai_content_draft_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_drafts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          background_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          level: Database["public"]["Enums"]["knowledge_level"]
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          level?: Database["public"]["Enums"]["knowledge_level"]
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          level?: Database["public"]["Enums"]["knowledge_level"]
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      feedback_report_reads: {
        Row: {
          admin_id: string
          read_at: string
          report_id: string
        }
        Insert: {
          admin_id: string
          read_at?: string
          report_id: string
        }
        Update: {
          admin_id?: string
          read_at?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_report_reads_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_report_reads_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "feedback_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_reports: {
        Row: {
          author_id: string
          created_at: string
          id: string
          image_urls: string[]
          kind: string
          message: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          image_urls?: string[]
          kind?: string
          message: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          image_urls?: string[]
          kind?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_reports_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_grammar_completions: {
        Row: {
          completed_at: string
          id: string
          student_id: string
          topic_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          student_id: string
          topic_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          student_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_grammar_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_grammar_completions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "homework_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_grammar_points: {
        Row: {
          created_at: string
          example: string | null
          explanation: string
          id: string
          order_index: number
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          example?: string | null
          explanation: string
          id?: string
          order_index?: number
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          example?: string | null
          explanation?: string
          id?: string
          order_index?: number
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_grammar_points_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "homework_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_grammar_tasks: {
        Row: {
          content: Json
          created_at: string
          id: string
          order_index: number
          task_type: Database["public"]["Enums"]["mission_task_type"]
          topic_id: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          order_index?: number
          task_type: Database["public"]["Enums"]["mission_task_type"]
          topic_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          order_index?: number
          task_type?: Database["public"]["Enums"]["mission_task_type"]
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_grammar_tasks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "homework_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_topic_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          topic_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          topic_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_topic_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_topic_messages_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "homework_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_topic_reads: {
        Row: {
          last_read_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_topic_reads_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "homework_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_topic_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_vocab_completions: {
        Row: {
          completed_at: string
          id: string
          student_id: string
          topic_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          student_id: string
          topic_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          student_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_vocab_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_vocab_completions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "homework_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_vocab_tasks: {
        Row: {
          content: Json
          created_at: string
          id: string
          order_index: number
          task_type: Database["public"]["Enums"]["mission_task_type"]
          topic_id: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          order_index?: number
          task_type: Database["public"]["Enums"]["mission_task_type"]
          topic_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          order_index?: number
          task_type?: Database["public"]["Enums"]["mission_task_type"]
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_vocab_tasks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "homework_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_vocab_words: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          order_index: number
          topic_id: string
          transcription: string | null
          translation: string
          updated_at: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_index?: number
          topic_id: string
          transcription?: string | null
          translation: string
          updated_at?: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_index?: number
          topic_id?: string
          transcription?: string | null
          translation?: string
          updated_at?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_vocab_words_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "homework_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_image_cache: {
        Row: {
          created_at: string
          image_url: string
          updated_at: string
          word_key: string
        }
        Insert: {
          created_at?: string
          image_url: string
          updated_at?: string
          word_key: string
        }
        Update: {
          created_at?: string
          image_url?: string
          updated_at?: string
          word_key?: string
        }
        Relationships: []
      }
      task_image_cache: {
        Row: {
          created_at: string
          image_url: string
          updated_at: string
          word_key: string
        }
        Insert: {
          created_at?: string
          image_url: string
          updated_at?: string
          word_key: string
        }
        Update: {
          created_at?: string
          image_url?: string
          updated_at?: string
          word_key?: string
        }
        Relationships: []
      }
      homework_topics: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          note_image_url: string | null
          note_link_url: string | null
          note_text: string | null
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          note_image_url?: string | null
          note_link_url?: string | null
          note_text?: string | null
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          note_image_url?: string | null
          note_link_url?: string | null
          note_text?: string | null
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_topics_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "teacher_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          description: string | null
          district_id: string
          icon_url: string | null
          id: string
          is_published: boolean
          map_x: number | null
          map_y: number | null
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          district_id: string
          icon_url?: string | null
          id?: string
          is_published?: boolean
          map_x?: number | null
          map_y?: number | null
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          district_id?: string
          icon_url?: string | null
          id?: string
          is_published?: boolean
          map_x?: number | null
          map_y?: number | null
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_tasks: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_published: boolean
          mission_id: string
          order_index: number
          task_type: Database["public"]["Enums"]["mission_task_type"]
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          mission_id: string
          order_index?: number
          task_type: Database["public"]["Enums"]["mission_task_type"]
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          mission_id?: string
          order_index?: number
          task_type?: Database["public"]["Enums"]["mission_task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_tasks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          coin_reward: number
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          location_id: string
          order_index: number
          title: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          coin_reward?: number
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          location_id: string
          order_index?: number
          title: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          coin_reward?: number
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          location_id?: string
          order_index?: number
          title?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "missions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string
          id: string
          level: Database["public"]["Enums"]["knowledge_level"]
          role: Database["public"]["Enums"]["user_role"]
          username: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          id: string
          level?: Database["public"]["Enums"]["knowledge_level"]
          role?: Database["public"]["Enums"]["user_role"]
          username: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["knowledge_level"]
          role?: Database["public"]["Enums"]["user_role"]
          username?: string
        }
        Relationships: []
      }
      study_time_daily: {
        Row: {
          day: string
          profile_id: string
          seconds: number
          updated_at: string
        }
        Insert: {
          day?: string
          profile_id: string
          seconds?: number
          updated_at?: string
        }
        Update: {
          day?: string
          profile_id?: string
          seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_time_daily_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_type_templates: {
        Row: {
          content: Json
          created_at: string
          is_published: boolean
          task_type: Database["public"]["Enums"]["mission_task_type"]
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          is_published?: boolean
          task_type: Database["public"]["Enums"]["mission_task_type"]
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          is_published?: boolean
          task_type?: Database["public"]["Enums"]["mission_task_type"]
          updated_at?: string
        }
        Relationships: []
      }
      teacher_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "teacher_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          profile_id: string
          unlocked_at: string
        }
        Insert: {
          achievement_id: string
          id?: string
          profile_id: string
          unlocked_at?: string
        }
        Update: {
          achievement_id?: string
          id?: string
          profile_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          coins_earned: number | null
          completed_at: string | null
          created_at: string
          id: string
          location_id: string
          mission_id: string
          profile_id: string
          score: number | null
          xp_earned: number | null
        }
        Insert: {
          coins_earned?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          location_id: string
          mission_id: string
          profile_id: string
          score?: number | null
          xp_earned?: number | null
        }
        Update: {
          coins_earned?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          location_id?: string
          mission_id?: string
          profile_id?: string
          score?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          coins: number
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          level: number
          longest_streak: number
          profile_id: string
          updated_at: string
          xp: number
        }
        Insert: {
          coins?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          profile_id: string
          updated_at?: string
          xp?: number
        }
        Update: {
          coins?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          profile_id?: string
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wardrobe_items: {
        Row: {
          acquired_at: string
          equipped: boolean
          equipped_at: string | null
          id: string
          item_type: string | null
          profile_id: string
          wardrobe_item_id: string
        }
        Insert: {
          acquired_at?: string
          equipped?: boolean
          equipped_at?: string | null
          id?: string
          item_type?: string | null
          profile_id: string
          wardrobe_item_id: string
        }
        Update: {
          acquired_at?: string
          equipped?: boolean
          equipped_at?: string | null
          id?: string
          item_type?: string | null
          profile_id?: string
          wardrobe_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wardrobe_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_wardrobe_items_wardrobe_item_id_fkey"
            columns: ["wardrobe_item_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_items"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_items: {
        Row: {
          audio_url: string | null
          created_at: string
          example_sentence: string | null
          id: string
          image_url: string | null
          is_published: boolean
          mission_id: string
          translation: string
          updated_at: string
          word: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          example_sentence?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          mission_id: string
          translation: string
          updated_at?: string
          word: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          example_sentence?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          mission_id?: string
          translation?: string
          updated_at?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_items_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      wardrobe_items: {
        Row: {
          cost_coins: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_default: boolean
          is_published: boolean
          item_type: string
          name: string
          order_index: number
          preview_url: string | null
          unlock_level: number | null
          updated_at: string
        }
        Insert: {
          cost_coins?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_default?: boolean
          is_published?: boolean
          item_type: string
          name: string
          order_index?: number
          preview_url?: string | null
          unlock_level?: number | null
          updated_at?: string
        }
        Update: {
          cost_coins?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_default?: boolean
          is_published?: boolean
          item_type?: string
          name?: string
          order_index?: number
          preview_url?: string | null
          unlock_level?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_profile: {
        Args: {
          p_level?: string
          p_role: string
          p_user_id: string
          p_username: string
        }
        Returns: {
          reason: string
          success: boolean
        }[]
      }
      admin_delete_user: {
        Args: { p_profile_id: string }
        Returns: {
          reason: string
          success: boolean
        }[]
      }
      admin_derive_username: { Args: { p_email: string }; Returns: string }
      admin_list_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_search?: string
        }
        Returns: {
          created_at: string
          email: string
          has_profile: boolean
          id: string
          is_confirmed: boolean
          level: Database["public"]["Enums"]["knowledge_level"]
          role: Database["public"]["Enums"]["user_role"]
          total_count: number
          username: string
        }[]
      }
      admin_set_user_role: {
        Args: { p_profile_id: string; p_role: string }
        Returns: {
          reason: string
          success: boolean
        }[]
      }
      advance_my_level_if_cleared: {
        Args: never
        Returns: Database["public"]["Enums"]["knowledge_level"]
      }
      available_knowledge_levels: {
        Args: never
        Returns: Database["public"]["Enums"]["knowledge_level"][]
      }
      claim_admin: { Args: never; Returns: boolean }
      complete_homework_grammar: {
        Args: { p_topic_id: string }
        Returns: {
          already_completed: boolean
          xp_earned: number
        }[]
      }
      complete_homework_vocab: {
        Args: { p_topic_id: string }
        Returns: {
          already_completed: boolean
          xp_earned: number
        }[]
      }
      complete_mission: {
        Args: { p_mission_id: string; p_reward_fraction?: number }
        Returns: {
          already_completed: boolean
          coins_earned: number
          xp_earned: number
        }[]
      }
      equip_wardrobe_item: { Args: { p_item_id: string }; Returns: undefined }
      list_feedback_reports: {
        Args: never
        Returns: {
          author_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          author_username: string
          created_at: string
          id: string
          image_urls: string[]
          is_read: boolean
          kind: string
          message: string
        }[]
      }
      mark_feedback_read: { Args: never; Returns: number }
      unread_feedback_count: { Args: never; Returns: number }
      get_topic_messages: {
        Args: { p_topic_id: string }
        Returns: {
          author_id: string
          author_is_teacher: boolean
          author_username: string
          body: string
          created_at: string
          id: string
        }[]
      }
      get_unread_topics: {
        Args: never
        Returns: {
          topic_id: string
          unread_count: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      knowledge_level_completed: {
        Args: { p_level: Database["public"]["Enums"]["knowledge_level"]; p_profile: string }
        Returns: boolean
      }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      is_linked_student: { Args: { p_student_id: string }; Returns: boolean }
      is_teacher: { Args: never; Returns: boolean }
      link_student_by_email: {
        Args: { p_student_email: string }
        Returns: {
          linked: boolean
          reason: string
          student_id: string
        }[]
      }
      my_groups: {
        Args: never
        Returns: {
          group_id: string
          group_name: string
          teacher_id: string
          teacher_username: string
        }[]
      }
      parent_student_homework: {
        Args: { p_student_id: string }
        Returns: {
          grammar_completed_at: string | null
          grammar_count: number
          group_name: string
          teacher_username: string | null
          title: string
          topic_id: string
          vocab_completed_at: string | null
          word_count: number
        }[]
      }
      promote_teacher: {
        Args: { p_identifier: string }
        Returns: {
          profile_id: string
          reason: string
          success: boolean
          username: string
        }[]
      }
      purchase_wardrobe_item: {
        Args: { p_item_id: string }
        Returns: {
          coins_remaining: number
          item_id: string
        }[]
      }
      record_study_time: { Args: { p_seconds: number }; Returns: number }
      reset_level_progress: { Args: never; Returns: undefined }
      reset_location_progress: {
        Args: { p_location_id: string }
        Returns: undefined
      }
      reset_my_progress: { Args: never; Returns: undefined }
      revoke_teacher: { Args: { p_profile_id: string }; Returns: boolean }
      set_location_map_position: {
        Args: { p_location_id: string; p_map_x: number; p_map_y: number }
        Returns: undefined
      }
      set_my_knowledge_level: {
        Args: { p_level: Database["public"]["Enums"]["knowledge_level"] }
        Returns: undefined
      }
      teaches_student: { Args: { p_student_id: string }; Returns: boolean }
      unequip_wardrobe_item: { Args: { p_item_id: string }; Returns: undefined }
    }
    Enums: {
      ai_content_draft_status: "pending" | "approved" | "rejected"
      knowledge_level:
        | "beginner"
        | "elementary"
        | "pre_intermediate"
        | "intermediate"
        | "upper_intermediate"
      mission_task_type:
        | "vocabulary"
        | "matching"
        | "quiz"
        | "snake_game"
        | "word_scramble"
        | "hangman"
        | "bubble_pop"
        | "memory_cards"
        | "emoji_decode"
        | "word_search"
        | "crossword"
        | "category_sort"
        | "odd_one_out"
        | "sentence_builder"
        | "fill_blank"
        | "spelling_bee"
        | "true_false"
        | "flashcards"
        | "story_sequencing"
        | "counting_game"
        | "simon_sequence"
        | "reaction_tap"
        | "picture_reveal"
        | "rhyme_match"
        | "letter_fill"
        | "dialogue_choice"
        | "cause_effect"
        | "analogy"
        | "antonym_match"
        | "size_order"
        | "spot_the_difference"
        | "clock_reading"
      user_role: "student" | "parent" | "admin" | "teacher"
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
      ai_content_draft_status: ["pending", "approved", "rejected"],
      knowledge_level: [
        "beginner",
        "elementary",
        "pre_intermediate",
        "intermediate",
        "upper_intermediate",
      ],
      mission_task_type: [
        "vocabulary",
        "matching",
        "quiz",
        "snake_game",
        "word_scramble",
        "hangman",
        "bubble_pop",
        "memory_cards",
        "emoji_decode",
        "word_search",
        "crossword",
        "category_sort",
        "odd_one_out",
        "sentence_builder",
        "fill_blank",
        "spelling_bee",
        "true_false",
        "flashcards",
        "story_sequencing",
        "counting_game",
        "simon_sequence",
        "reaction_tap",
        "picture_reveal",
        "rhyme_match",
        "letter_fill",
        "dialogue_choice",
        "cause_effect",
        "analogy",
        "antonym_match",
        "size_order",
        "spot_the_difference",
        "clock_reading",
      ],
      user_role: ["student", "parent", "admin", "teacher"],
    },
  },
} as const
