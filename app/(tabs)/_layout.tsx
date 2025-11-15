import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesomeIcon from '@expo/vector-icons/FontAwesome';
import { Tabs } from "expo-router";
import { Text, View } from "react-native";

export default function TabsLayout() {
  return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#0d0d00",
            height: 115,
            paddingTop: 20,
            borderTopWidth: 0,
            paddingHorizontal: 10,
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: "#ffffff",
          tabBarInactiveTintColor: "#757575",
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            tabBarIcon: ({ color }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, height: 60 }}>
                <FontAwesome6 name="house" size={24} color={color} weight="fill" />
                <Text style={{ color, fontSize: 11, textAlign: "center", marginTop: 4 }}>Home</Text>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            tabBarIcon: ({ color }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, height: 60 }}>
                <Ionicons name="search" size={25} color={color} weight="fill" />
                <Text style={{ color, fontSize: 11, textAlign: "center", marginTop: 4 }}>Buscar</Text>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="emprestimo"
          options={{
            tabBarIcon: ({ color }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, height: 60 }}>
                <FontAwesome6 name="book-bookmark" size={24} color={color} weight="fill" />
                <Text style={{ color, fontSize: 11, textAlign: "center", marginTop: 4 }}>Emprestimo</Text>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="meusLivros"
          options={{
            tabBarIcon: ({ color }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, height: 60 }}>
                <Ionicons name="bookmarks" size={24} color={color} weight="fill" />
                <Text style={{ color, fontSize: 11, textAlign: "center", marginTop: 4 }}>Meus Livros</Text>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            tabBarIcon: ({ color }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, height: 60 }}>
                <FontAwesomeIcon  name="user" size={24} color={color} weight="fill" />
                <Text style={{ color, fontSize: 11, textAlign: "center", marginTop: 4 }}>Perfil</Text>
              </View>
            ),
          }}
        />
      </Tabs>
  )
}