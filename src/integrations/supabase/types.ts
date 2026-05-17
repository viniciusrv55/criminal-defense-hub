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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_agent_knowledge: {
        Row: {
          active: boolean
          agent_id: string
          content: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          agent_id: string
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_knowledge_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_runs: {
        Row: {
          agent_id: string | null
          completion_tokens: number | null
          conversation_id: string | null
          created_at: string
          error: string | null
          id: string
          inbound_message_id: string | null
          latency_ms: number | null
          model: string | null
          outbound_message_id: string | null
          prompt_tokens: number | null
          status: string
          tool_calls: Json
        }
        Insert: {
          agent_id?: string | null
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          inbound_message_id?: string | null
          latency_ms?: number | null
          model?: string | null
          outbound_message_id?: string | null
          prompt_tokens?: number | null
          status?: string
          tool_calls?: Json
        }
        Update: {
          agent_id?: string | null
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          inbound_message_id?: string | null
          latency_ms?: number | null
          model?: string | null
          outbound_message_id?: string | null
          prompt_tokens?: number | null
          status?: string
          tool_calls?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          active: boolean
          business_hours: Json | null
          created_at: string
          greeting_message: string | null
          handoff_after_messages: number | null
          handoff_keywords: string[]
          id: string
          max_tokens: number
          model: string
          name: string
          queue_id: string
          system_prompt: string
          temperature: number
          tools_enabled: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_hours?: Json | null
          created_at?: string
          greeting_message?: string | null
          handoff_after_messages?: number | null
          handoff_keywords?: string[]
          id?: string
          max_tokens?: number
          model?: string
          name: string
          queue_id: string
          system_prompt?: string
          temperature?: number
          tools_enabled?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_hours?: Json | null
          created_at?: string
          greeting_message?: string | null
          handoff_after_messages?: number | null
          handoff_keywords?: string[]
          id?: string
          max_tokens?: number
          model?: string
          name?: string
          queue_id?: string
          system_prompt?: string
          temperature?: number
          tools_enabled?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_availability: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          start_time: string
          team_member_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          team_member_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          team_member_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      appointment_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          team_member_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          team_member_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          team_member_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointment_types: {
        Row: {
          active: boolean
          color: string
          created_at: string
          default_location: string | null
          duration_minutes: number
          id: string
          name: string
          requires_attorney: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          default_location?: string | null
          duration_minutes?: number
          id?: string
          name: string
          requires_attorney?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          default_location?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          requires_attorney?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          all_day: boolean
          appointment_type_id: string | null
          attendees: string[]
          attorney_id: string | null
          client_id: string | null
          confirmation_sent_at: string | null
          contract_id: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          created_via: string
          description: string | null
          ends_at: string
          external_calendar_id: string | null
          id: string
          lead_id: string | null
          location: string | null
          meeting_url: string | null
          notes: string | null
          practice_area_id: string | null
          reminder_sent_at: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          appointment_type_id?: string | null
          attendees?: string[]
          attorney_id?: string | null
          client_id?: string | null
          confirmation_sent_at?: string | null
          contract_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          description?: string | null
          ends_at: string
          external_calendar_id?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          practice_area_id?: string | null
          reminder_sent_at?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          appointment_type_id?: string | null
          attendees?: string[]
          attorney_id?: string | null
          client_id?: string | null
          confirmation_sent_at?: string | null
          contract_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          description?: string | null
          ends_at?: string
          external_calendar_id?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          practice_area_id?: string | null
          reminder_sent_at?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attorney_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          practice_area_ids: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          practice_area_ids?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          practice_area_ids?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blog_images: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          post_id: string
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          post_id: string
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          post_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          meta_description: string | null
          published: boolean | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          published?: boolean | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          published?: boolean | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_groups: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          practice_area_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          practice_area_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          practice_area_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_groups_practice_area_id_fkey"
            columns: ["practice_area_id"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_access: {
        Row: {
          active: boolean
          birthday_day: number | null
          birthday_month: number | null
          client_id: string
          created_at: string
          id: string
          nickname: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          active?: boolean
          birthday_day?: number | null
          birthday_month?: number | null
          client_id: string
          created_at?: string
          id?: string
          nickname?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          active?: boolean
          birthday_day?: number | null
          birthday_month?: number | null
          client_id?: string
          created_at?: string
          id?: string
          nickname?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          birth_date: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          contact_name: string | null
          contact_phone: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          education: string | null
          emails: Json
          father_name: string | null
          full_name: string
          group_id: string | null
          group_name: string | null
          id: string
          lead_id: string | null
          marital_status: string | null
          mother_name: string | null
          nationality: string | null
          neighborhood: string | null
          notes: string | null
          person_type: string
          phones: Json
          pis: string | null
          profession: string | null
          profile_type: string | null
          rg: string | null
          social_name: string | null
          state: string | null
          state_registration: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          education?: string | null
          emails?: Json
          father_name?: string | null
          full_name: string
          group_id?: string | null
          group_name?: string | null
          id?: string
          lead_id?: string | null
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          person_type?: string
          phones?: Json
          pis?: string | null
          profession?: string | null
          profile_type?: string | null
          rg?: string | null
          social_name?: string | null
          state?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          education?: string | null
          emails?: Json
          father_name?: string | null
          full_name?: string
          group_id?: string | null
          group_name?: string | null
          id?: string
          lead_id?: string | null
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          person_type?: string
          phones?: Json
          pis?: string | null
          profession?: string | null
          profile_type?: string | null
          rg?: string | null
          social_name?: string | null
          state?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      comarcas: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contract_documents: {
        Row: {
          contract_id: string
          copies: number
          created_at: string
          document_type: string
          file_name: string | null
          file_url: string | null
          generated_by: string | null
          generated_html: string | null
          id: string
          template_name: string | null
        }
        Insert: {
          contract_id: string
          copies?: number
          created_at?: string
          document_type: string
          file_name?: string | null
          file_url?: string | null
          generated_by?: string | null
          generated_html?: string | null
          id?: string
          template_name?: string | null
        }
        Update: {
          contract_id?: string
          copies?: number
          created_at?: string
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          generated_by?: string | null
          generated_html?: string | null
          id?: string
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_history: {
        Row: {
          action: string
          contract_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          performed_by: string | null
        }
        Insert: {
          action: string
          contract_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          contract_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          additional_data: Json
          adverse_party: Json
          attorney_id: string | null
          client_id: string
          comarca_id: string | null
          contract_number: string | null
          created_at: string
          created_by: string | null
          fees: Json
          group_id: string | null
          id: string
          notes: string | null
          party_type: string | null
          practice_area_id: string | null
          process_data: Json
          process_type: string | null
          status: string
          updated_at: string
          vara_id: string | null
        }
        Insert: {
          additional_data?: Json
          adverse_party?: Json
          attorney_id?: string | null
          client_id: string
          comarca_id?: string | null
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          fees?: Json
          group_id?: string | null
          id?: string
          notes?: string | null
          party_type?: string | null
          practice_area_id?: string | null
          process_data?: Json
          process_type?: string | null
          status?: string
          updated_at?: string
          vara_id?: string | null
        }
        Update: {
          additional_data?: Json
          adverse_party?: Json
          attorney_id?: string | null
          client_id?: string
          comarca_id?: string | null
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          fees?: Json
          group_id?: string | null
          id?: string
          notes?: string | null
          party_type?: string | null
          practice_area_id?: string | null
          process_data?: Json
          process_type?: string | null
          status?: string
          updated_at?: string
          vara_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_comarca_id_fkey"
            columns: ["comarca_id"]
            isOneToOne: false
            referencedRelation: "comarcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_vara_id_fkey"
            columns: ["vara_id"]
            isOneToOne: false
            referencedRelation: "varas"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          active: boolean
          assigned_team_member_ids: string[]
          content_html: string
          created_at: string
          created_by: string | null
          doc_date: string | null
          id: string
          owner_id: string
          title: string
          type_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_team_member_ids?: string[]
          content_html?: string
          created_at?: string
          created_by?: string | null
          doc_date?: string | null
          id?: string
          owner_id: string
          title: string
          type_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_team_member_ids?: string[]
          content_html?: string
          created_at?: string
          created_by?: string | null
          doc_date?: string | null
          id?: string
          owner_id?: string
          title?: string
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "document_template_types"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_attorneys: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          oab_number: string | null
          photo_url: string | null
          sort_order: number
          specialty: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id?: string
          oab_number?: string | null
          photo_url?: string | null
          sort_order?: number
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          oab_number?: string | null
          photo_url?: string | null
          sort_order?: number
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kanban_stage_permissions: {
        Row: {
          can_act: boolean
          created_at: string
          id: string
          stage: string
          team_member_id: string
        }
        Insert: {
          can_act?: boolean
          created_at?: string
          id?: string
          stage: string
          team_member_id: string
        }
        Update: {
          can_act?: boolean
          created_at?: string
          id?: string
          stage?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_stage_permissions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_history: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          lead_id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_attorney_id: string | null
          created_at: string | null
          email: string | null
          id: string
          kanban_status: string | null
          message: string | null
          name: string
          phone: string | null
          practice_area_id: string | null
          responsible_ids: string[]
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_attorney_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          kanban_status?: string | null
          message?: string | null
          name: string
          phone?: string | null
          practice_area_id?: string | null
          responsible_ids?: string[]
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_attorney_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          kanban_status?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          practice_area_id?: string | null
          responsible_ids?: string[]
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_practice_area_id_fkey"
            columns: ["practice_area_id"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      practice_areas: {
        Row: {
          active: boolean | null
          content: string | null
          cover_image_url: string | null
          created_at: string | null
          cta_button_text: string | null
          description: string | null
          featured: boolean
          gallery: Json
          icon_color: string | null
          icon_name: string | null
          icon_svg: string | null
          id: string
          slug: string | null
          sort_order: number | null
          subtitle: string | null
          title: string
          updated_at: string | null
          whatsapp_message: string | null
          youtube_url: string | null
        }
        Insert: {
          active?: boolean | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_button_text?: string | null
          description?: string | null
          featured?: boolean
          gallery?: Json
          icon_color?: string | null
          icon_name?: string | null
          icon_svg?: string | null
          id?: string
          slug?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
          whatsapp_message?: string | null
          youtube_url?: string | null
        }
        Update: {
          active?: boolean | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_button_text?: string | null
          description?: string | null
          featured?: boolean
          gallery?: Json
          icon_color?: string | null
          icon_name?: string | null
          icon_svg?: string | null
          id?: string
          slug?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
          whatsapp_message?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role_title: string | null
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          role_title?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role_title?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      varas: {
        Row: {
          active: boolean
          comarca_id: string
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          updated_at: string
          vara_number: string
        }
        Insert: {
          active?: boolean
          comarca_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          updated_at?: string
          vara_number: string
        }
        Update: {
          active?: boolean
          comarca_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          updated_at?: string
          vara_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "varas_comarca_id_fkey"
            columns: ["comarca_id"]
            isOneToOne: false
            referencedRelation: "comarcas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_notes: {
        Row: {
          author_user_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_user_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_user_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_transfers: {
        Row: {
          conversation_id: string
          from_queue_id: string | null
          from_user_id: string | null
          id: string
          note: string | null
          to_queue_id: string | null
          to_user_id: string | null
          transferred_at: string
        }
        Insert: {
          conversation_id: string
          from_queue_id?: string | null
          from_user_id?: string | null
          id?: string
          note?: string | null
          to_queue_id?: string | null
          to_user_id?: string | null
          transferred_at?: string
        }
        Update: {
          conversation_id?: string
          from_queue_id?: string | null
          from_user_id?: string | null
          id?: string
          note?: string | null
          to_queue_id?: string | null
          to_user_id?: string | null
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_transfers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          ai_enabled: boolean
          ai_handoff_reason: string | null
          ai_paused_at: string | null
          assigned_team_member_id: string | null
          client_id: string | null
          contact_avatar_url: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          current_queue_id: string | null
          id: string
          instance_id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_handoff_reason?: string | null
          ai_paused_at?: string | null
          assigned_team_member_id?: string | null
          client_id?: string | null
          contact_avatar_url?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          current_queue_id?: string | null
          id?: string
          instance_id: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_handoff_reason?: string | null
          ai_paused_at?: string | null
          assigned_team_member_id?: string | null
          client_id?: string | null
          contact_avatar_url?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          current_queue_id?: string | null
          id?: string
          instance_id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_current_queue_id_fkey"
            columns: ["current_queue_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instance_name: string
          last_connected_at: string | null
          name: string
          phone_number: string | null
          qr_code: string | null
          status: string
          team_member_id: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instance_name: string
          last_connected_at?: string | null
          name: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          team_member_id?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instance_name?: string
          last_connected_at?: string | null
          name?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          team_member_id?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          evolution_message_id: string | null
          from_phone: string | null
          id: string
          media_mime: string | null
          media_url: string | null
          message_type: string
          metadata: Json
          sent_by_user_id: string | null
          status: string
          to_phone: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          evolution_message_id?: string | null
          from_phone?: string | null
          id?: string
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json
          sent_by_user_id?: string | null
          status?: string
          to_phone?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          evolution_message_id?: string | null
          from_phone?: string | null
          id?: string
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json
          sent_by_user_id?: string | null
          status?: string
          to_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_queue_members: {
        Row: {
          created_at: string
          id: string
          queue_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          queue_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string
          id?: string
          queue_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_queue_members_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_queue_members_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_queues: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          team_member_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          team_member_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          team_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_queues_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_logs: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          id: string
          instance_name: string | null
          payload: Json
          processed: boolean
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          instance_name?: string | null
          payload?: Json
          processed?: boolean
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          instance_name?: string | null
          payload?: Json
          processed?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_appointment: {
        Args: { _appt_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      can_act_on_stage: {
        Args: { _stage: string; _user_id: string }
        Returns: boolean
      }
      can_use_document_template: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_contract_attorney: {
        Args: { _contract_id: string; _user_id: string }
        Returns: boolean
      }
      is_lead_responsible: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "attorney" | "team_member" | "client"
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
      app_role: ["super_admin", "admin", "attorney", "team_member", "client"],
    },
  },
} as const
